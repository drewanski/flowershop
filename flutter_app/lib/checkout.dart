import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core.dart';
import 'ui.dart';
import 'orders.dart';

class CheckoutScreen extends StatefulWidget {
  final ShopStore store;
  const CheckoutScreen(this.store, {super.key});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final form = GlobalKey<FormState>();
  final search = TextEditingController(),
      code = TextEditingController(),
      note = TextEditingController();
  final fields = <String, TextEditingController>{};
  final map = MapController();
  late final String owner, fingerprint;
  late final List<Json> products;
  Json? quote;
  List<Json> offers = [], vouchers = [], matches = [];
  List<String> methods = ['cash'];
  final selected = <String>[];
  String payment = 'cash', error = '', lookupMessage = '';
  bool loading = true, looking = false, quoting = false;
  LatLng? point;
  int lookupVersion = 0;
  @override
  void initState() {
    super.initState();
    owner = widget.store.scope;
    products = widget.store.bag.map((l) => l.payload).toList();
    fingerprint = jsonEncode(products);
    for (final key in [
      'apartmentBuildingLotNumber',
      'street',
      'barangay',
      'city',
      'province',
      'zipCode',
      'riderInstructions',
    ]) {
      fields[key] = TextEditingController(
        text: '${widget.store.address[key] ?? ''}',
      );
    }
    if (widget.store.address['latitude'] != null &&
        widget.store.address['longitude'] != null) {
      point = LatLng(
        number(widget.store.address['latitude']),
        number(widget.store.address['longitude']),
      );
    }
    boot();
  }

  @override
  void dispose() {
    for (final c in [...fields.values, search, code, note]) {
      c.dispose();
    }
    map.dispose();
    super.dispose();
  }

  Future<void> boot() async {
    try {
      final results = await Future.wait([
        widget.store.api.get('/payments/methods'),
        widget.store.api.get('/vouchers/customer/mine'),
        widget.store.api.get('/vouchers/customer/available'),
        widget.store.api.post('/vouchers/customer/preview', {
          'products': products,
          'voucherIds': selected,
        }),
      ]);
      if (!mounted) return;
      setState(() {
        methods = List<String>.from(results[0] ?? ['cash']);
        vouchers = rows(results[1]);
        offers = rows(results[2]);
        quote = obj(results[3]);
        error = '';
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> recalculate() async {
    setState(() {
      quoting = true;
      quote = null;
      error = '';
    });
    try {
      final value = obj(
        await widget.store.api.post('/vouchers/customer/preview', {
          'products': products,
          'voucherIds': selected,
        }),
      );
      if (mounted) setState(() => quote = value);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => quoting = false);
    }
  }

  Future<void> claim(String value) async {
    await widget.store.api.post('/vouchers/claim', {
      'code': value.trim().toUpperCase(),
    });
    final data = await Future.wait([
      widget.store.api.get('/vouchers/customer/mine'),
      widget.store.api.get('/vouchers/customer/available'),
    ]);
    if (mounted) {
      setState(() {
        vouchers = rows(data[0]);
        offers = rows(data[1]);
        code.clear();
      });
      notice(context, 'Voucher claimed. Select it below to apply.');
    }
  }

  Future<void> findAddress() async {
    if (search.text.trim().length < 4) {
      throw ApiException('Enter at least four characters.');
    }
    setState(() => looking = true);
    try {
      final result = rows(
        await widget.store.api.post('/locations/geocode', {
          'query': search.text.trim(),
        }),
      );
      if (mounted) {
        setState(() {
          matches = result;
          lookupMessage = result.isEmpty
              ? 'No matches. Tap the map and complete the address.'
              : '';
        });
      }
    } finally {
      if (mounted) setState(() => looking = false);
    }
  }

  Future<void> pin(LatLng value) async {
    final version = ++lookupVersion;
    setState(() {
      point = value;
      matches = [];
      looking = true;
      lookupMessage = 'Looking up this delivery point...';
    });
    try {
      final address = obj(
        await widget.store.api.post('/locations/reverse', {
          'latitude': value.latitude,
          'longitude': value.longitude,
        }),
      );
      if (!mounted || version != lookupVersion) return;
      for (final key in ['street', 'barangay', 'city', 'province', 'zipCode']) {
        fields[key]!.text = '${address[key] ?? ''}';
      }
      setState(
        () => lookupMessage =
            'Pin selected. Check the address and add your unit or landmark.',
      );
      await saveAddress();
    } catch (e) {
      if (mounted && version == lookupVersion) {
        setState(
          () => lookupMessage = 'Address lookup unavailable. Fill in the address below; your pin is selected.',
        );
      }
    } finally {
      if (mounted && version == lookupVersion) setState(() => looking = false);
    }
  }

  Json get address => {
    for (final entry in fields.entries) entry.key: entry.value.text.trim(),
    if (point != null) 'latitude': point!.latitude,
    if (point != null) 'longitude': point!.longitude,
  };
  Future<void> saveAddress() async {
    if (widget.store.scope != owner) return;
    widget.store.address = address;
    await widget.store.persist();
  }

  Future<void> placeOrder() async {
    if (!widget.store.signedIn || widget.store.scope != owner) {
      throw ApiException(
        'Sign in with the same customer account before checking out.',
      );
    }
    if (!form.currentState!.validate()) return;
    if (point == null) {
      throw ApiException('Select your delivery point on the map.');
    }
    if (quote == null || loading || quoting || looking) {
      throw ApiException(
        'Wait for the address and order total to be confirmed.',
      );
    }
    if (jsonEncode(widget.store.bag.map((l) => l.payload).toList()) !=
        fingerprint) {
      throw ApiException(
        'Your bag changed. Return to the bag and review it again.',
      );
    }
    await saveAddress();
    final order = obj(
      await widget.store.api.post('/orders', {
        'products': products,
        'paymentMethod': payment,
        'deliveryAddress': address,
        'notes': note.text.trim(),
        'voucherIds': selected,
      }),
    );
    if (order['_id'] == null) {
      throw ApiException(
        'Order response is incomplete. Check your order history before trying again.',
      );
    }
    if (payment == 'cash' || order['paymentStatus'] == 'paid') {
      await widget.store.clearPurchasedBag(fingerprint);
    } else {
      await widget.store.preferences?.setString(
        widget.store.storageKey('pending:${order['_id']}'),
        fingerprint,
      );
    }
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) =>
            OrderDetailScreen(widget.store, '${order['_id']}', initial: order),
      ),
    );
    if (payment == 'online' &&
        order['paymentStatus'] != 'paid' &&
        order['paymentCheckoutUrl'] != null) {
      final url = Uri.parse('${order['paymentCheckoutUrl']}');
      if (url.scheme == 'https' && url.host == 'checkout.paymongo.com') {
        final opened = await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
          webOnlyWindowName: '_blank',
        );
        if (!opened && mounted) {
          notice(context, 'Open secure payment from your order screen.');
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.store.scope != owner || !widget.store.signedIn) {
      return const Scaffold(
        body: EmptyState(
          'Sign-in required',
          'Return to your bag and sign in to continue.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Delivery & checkout')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : PageBody(
              children: [
                const Heading(
                  'One last look.',
                  'Choose your delivery point, review your coffee, and place your order.',
                ),
                if (error.isNotEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        error,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  ),
                if (quote == null)
                  OutlinedButton(
                    onPressed: recalculate,
                    child: const Text('Refresh order total'),
                  ),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'YOUR COFFEE',
                          style: TextStyle(
                            letterSpacing: 2,
                            fontSize: 11,
                            color: sage,
                          ),
                        ),
                        gap(),
                        for (final line in widget.store.bag)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Text(
                              '${line.quantity} x ${line.product['name']}\n${line.description}',
                              style: const TextStyle(fontSize: 12, height: 1.7),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                gap(),
                Form(
                  key: form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Where should we bring your coffee?',
                        style: TextStyle(fontFamily: 'Gilda', fontSize: 27),
                      ),
                      gap(),
                      TextField(
                        controller: search,
                        decoration: const InputDecoration(
                          labelText: 'Search delivery address',
                          prefixIcon: Icon(Icons.search),
                        ),
                        onSubmitted: (_) => attempt(context, findAddress),
                      ),
                      gap(8),
                      OutlinedButton(
                        onPressed: looking
                            ? null
                            : () => attempt(context, findAddress),
                        child: Text(
                          looking
                              ? 'Finding your address...'
                              : 'Search address',
                        ),
                      ),
                      for (final match in matches)
                        Card(
                          child: ListTile(
                            title: Text(
                              '${match['label']}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: const Icon(Icons.location_on_outlined),
                            onTap: () {
                              final value = LatLng(
                                number(match['latitude']),
                                number(match['longitude']),
                              );
                              map.move(value, 16);
                              attempt(context, () => pin(value));
                            },
                          ),
                        ),
                      gap(),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: SizedBox(
                          height: 240,
                          child: FlutterMap(
                            mapController: map,
                            options: MapOptions(
                              initialCenter:
                                  point ?? const LatLng(14.5995, 120.9842),
                              initialZoom: point == null ? 13 : 16,
                              onTap: (_, p) => attempt(context, () => pin(p)),
                            ),
                            children: [
                              TileLayer(
                                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                userAgentPackageName: 'com.kapeandco.kape_co',
                              ),
                              if (point != null)
                                MarkerLayer(
                                  markers: [
                                    Marker(
                                      point: point!,
                                      width: 42,
                                      height: 42,
                                      child: const Icon(
                                        Icons.location_pin,
                                        size: 42,
                                        color: espresso,
                                      ),
                                    ),
                                  ],
                                ),
                              RichAttributionWidget(
                                attributions: [
                                  TextSourceAttribution(
                                    'OpenStreetMap contributors',
                                    onTap: () => launchUrl(
                                      Uri.parse(
                                        'https://www.openstreetmap.org/copyright',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      gap(10),
                      Text(
                        lookupMessage.isEmpty
                            ? 'Tap the map to adjust the drop-off point.'
                            : lookupMessage,
                        style: const TextStyle(color: sage, fontSize: 11),
                      ),
                      gap(),
                      for (final entry in [
                        (
                          'apartmentBuildingLotNumber',
                          'Unit / building / landmark (optional)',
                        ),
                        ('street', 'Street'),
                        ('barangay', 'Barangay'),
                        ('city', 'City'),
                        ('province', 'Province / region'),
                        ('zipCode', 'Postal code (optional)'),
                        (
                          'riderInstructions',
                          'Delivery instructions (optional)',
                        ),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: TextFormField(
                            controller: fields[entry.$1],
                            decoration: InputDecoration(labelText: entry.$2),
                            onChanged: (_) => saveAddress(),
                            validator:
                                [
                                  'street',
                                  'barangay',
                                  'city',
                                  'province',
                                ].contains(entry.$1)
                                ? (v) => v == null || v.trim().isEmpty
                                      ? 'Required'
                                      : null
                                : null,
                          ),
                        ),
                      gap(),
                      ExpansionTile(
                        title: const Text('Have a voucher?'),
                        subtitle: Text('${selected.length} selected'),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: code,
                                        decoration: const InputDecoration(
                                          labelText: 'Voucher code',
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ActionButton(
                                      'Claim',
                                      () => claim(code.text),
                                    ),
                                  ],
                                ),
                                gap(),
                                for (final offer in offers)
                                  Card(
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${obj(offer['voucher'])['code']}',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          Text(
                                            '${obj(offer['voucher'])['description']}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                            ),
                                          ),
                                          if (offer['eligibilityReason'] !=
                                              null)
                                            Text(
                                              '${offer['eligibilityReason']}',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          if (offer['claimable'] == true)
                                            TextButton(
                                              onPressed: () => attempt(
                                                context,
                                                () => claim(
                                                  '${obj(offer['voucher'])['code']}',
                                                ),
                                              ),
                                              child: const Text('Claim offer'),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                for (final voucher in vouchers.where(
                                  (v) => v['status'] == 'active',
                                ))
                                  CheckboxListTile(
                                    contentPadding: EdgeInsets.zero,
                                    value: selected.contains(
                                      '${voucher['_id']}',
                                    ),
                                    title: Text(
                                      '${obj(voucher['voucher'])['code']}',
                                    ),
                                    subtitle: Text(
                                      '${obj(voucher['voucher'])['description']}\nMinimum ${money(obj(voucher['voucher'])['minOrderValue'])}',
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                    onChanged: quoting
                                        ? null
                                        : (value) {
                                            if (value == true &&
                                                selected.length >= 3) {
                                              notice(
                                                context,
                                                'Select up to three vouchers.',
                                              );
                                              return;
                                            }
                                            setState(() {
                                              if (value == true) {
                                                selected.add(
                                                  '${voucher['_id']}',
                                                );
                                              } else {
                                                selected.remove(
                                                  '${voucher['_id']}',
                                                );
                                              }
                                            });
                                            recalculate();
                                          },
                                  ),
                                if (vouchers.isEmpty)
                                  const Text(
                                    'Claim an offer to apply it to this order.',
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      gap(),
                      const Text(
                        'Payment method',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      gap(8),
                      Wrap(
                        spacing: 10,
                        children: methods
                            .map(
                              (method) => ChoiceChip(
                                label: Text(
                                  method == 'cash'
                                      ? 'Cash on delivery'
                                      : 'Pay online',
                                ),
                                selected: payment == method,
                                onSelected: (_) =>
                                    setState(() => payment = method),
                              ),
                            )
                            .toList(),
                      ),
                      gap(8),
                      Text(
                        payment == 'online'
                            ? 'Card, GCash, or QR Ph on secure PayMongo checkout. Payment is verified by the server.'
                            : 'Pay the rider when your coffee arrives.',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                      gap(),
                      TextField(
                        controller: note,
                        maxLines: 3,
                        maxLength: 500,
                        decoration: const InputDecoration(
                          labelText: 'A note for the barista (optional)',
                        ),
                      ),
                      gap(),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              totalRow(
                                'Items',
                                quote?['subtotal'] ?? widget.store.subtotal,
                              ),
                              totalRow(
                                'Voucher savings',
                                quote?['discount'] ?? 0,
                              ),
                              totalRow('Delivery', 0),
                              const Divider(),
                              totalRow(
                                'Order total',
                                quote?['total'] ?? widget.store.subtotal,
                                bold: true,
                              ),
                            ],
                          ),
                        ),
                      ),
                      gap(),
                      if (quoting)
                        const Center(child: CircularProgressIndicator()),
                      ActionButton(
                        number(quote?['total']) == 0 && quote != null
                            ? 'Place voucher-covered order'
                            : payment == 'online'
                            ? 'Continue to secure payment'
                            : 'Place cash order',
                        placeOrder,
                        icon: Icons.lock_outline,
                      ),
                      gap(),
                      const Text(
                        'Check the drop-off point and total before placing your order. An unpaid online order is not prepared until payment is verified.',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget totalRow(String label, dynamic value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          money(value),
          style: TextStyle(
            fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            fontSize: bold ? 23 : 14,
          ),
        ),
      ],
    ),
  );
}
