import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core.dart';
import 'ui.dart';
import 'account.dart';

class OrdersScreen extends StatefulWidget {
  final ShopStore store;
  const OrdersScreen(this.store, {super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with WidgetsBindingObserver {
  List<Json> orders = [];
  String error = '', filter = 'All';
  bool loading = false, foreground = true;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.store.signedIn) load();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (foreground && widget.store.signedIn) load();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (foreground && widget.store.signedIn) load();
  }

  Future<void> load() async {
    if (loading) return;
    final owner = widget.store.scope;
    setState(() => loading = true);
    try {
      final values = rows(await widget.store.api.get('/orders/mine'));
      values.sort((a, b) => '${b['createdAt']}'.compareTo('${a['createdAt']}'));
      if (mounted && owner == widget.store.scope) {
        setState(() {
          orders = values;
          error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.store.signedIn) {
      return EmptyState(
        'Follow your next cup.',
        'Sign in to see your orders and delivery updates.',
        action: ActionButton('Sign in', () async {
          if (await requireCustomer(context, widget.store) && mounted) {
            await load();
          }
        }),
      );
    }
    final visible = orders.where((o) {
      final closed = ['delivered', 'cancelled'].contains(o['status']);
      return filter == 'All' || (filter == 'Past' ? closed : !closed);
    }).toList();
    return PageBody(
      children: [
        const Heading(
          'Your coffee orders.',
          'From the first pour to your door. Updates every 30 seconds while open.',
        ),
        Row(
          children: [
            Expanded(
              child: Wrap(
                spacing: 8,
                children: ['All', 'In progress', 'Past']
                    .map(
                      (value) => ChoiceChip(
                        label: Text(value),
                        selected: filter == value,
                        onSelected: (_) => setState(() => filter = value),
                      ),
                    )
                    .toList(),
              ),
            ),
            IconButton(
              tooltip: 'Refresh orders',
              onPressed: loading ? null : load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        if (error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(error, style: const TextStyle(color: Colors.red)),
          ),
        if (loading && orders.isEmpty)
          const Center(child: CircularProgressIndicator()),
        if (!loading && visible.isEmpty)
          const EmptyState(
            'No orders in this view.',
            'Your next coffee moment is waiting on the menu.',
          ),
        for (final order in visible)
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(18),
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusBadge(
                    statusLabels['${order['status']}'] ?? '${order['status']}',
                  ),
                  gap(12),
                  Text(
                    '${order['orderNumber']}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  gap(6),
                  Text(
                    rows(order['products'])
                        .map(
                          (line) =>
                              '${line['quantity']} x ${line['productName'] ?? obj(line['product'])['name']}',
                        )
                        .join('\n'),
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '${paymentLabel(order)}\n${dateLabel(order['createdAt'])}',
                  style: const TextStyle(fontSize: 11, height: 1.7),
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => OrderDetailScreen(
                      widget.store,
                      '${order['_id']}',
                      initial: order,
                    ),
                  ),
                );
                if (mounted) load();
              },
            ),
          ),
      ],
    );
  }
}

class OrderDetailScreen extends StatefulWidget {
  final ShopStore store;
  final String id;
  final Json? initial;
  const OrderDetailScreen(this.store, this.id, {super.key, this.initial});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen>
    with WidgetsBindingObserver {
  Json? order;
  String error = '';
  bool busy = false, foreground = true;
  Timer? timer;
  late final String owner;
  @override
  void initState() {
    super.initState();
    owner = widget.store.scope;
    order = widget.initial;
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (foreground &&
          order?['status'] != 'cancelled' &&
          order?['status'] != 'delivered') {
        load();
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (foreground) load();
  }

  Future<void> load() async {
    if (busy || !widget.store.signedIn || widget.store.scope != owner) return;
    setState(() => busy = true);
    try {
      var current = obj(
        await widget.store.api.get('/orders/mine/${widget.id}'),
      );
      if (current['paymentMethod'] == 'online' &&
          current['paymentStatus'] == 'pending' &&
          current['status'] == 'pending') {
        await widget.store.api.post('/payments/orders/${widget.id}/verify', {});
        current = obj(await widget.store.api.get('/orders/mine/${widget.id}'));
      }
      if (current['paymentStatus'] == 'paid') {
        final key = widget.store.storageKey('pending:${widget.id}');
        final fingerprint = widget.store.preferences?.getString(key);
        if (fingerprint != null) {
          await widget.store.clearPurchasedBag(fingerprint);
          await widget.store.preferences?.remove(key);
        }
      }
      if (mounted && owner == widget.store.scope) {
        setState(() {
          order = current;
          error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> openPayment() async {
    final url = Uri.tryParse('${order?['paymentCheckoutUrl']}');
    if (url == null ||
        url.scheme != 'https' ||
        url.host != 'checkout.paymongo.com') {
      throw ApiException('No valid checkout link is available.');
    }
    if (!await launchUrl(
      url,
      mode: LaunchMode.externalApplication,
      webOnlyWindowName: '_blank',
    )) {
      throw ApiException('Could not open payment. Try again.');
    }
  }

  Future<void> cancelOrder() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const CancellationDialog(),
    );
    if (reason == null) return;
    await widget.store.api.post('/orders/mine/${widget.id}/cancel', {
      'reason': reason,
    });
    await load();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.store.signedIn || widget.store.scope != owner) {
      return Scaffold(
        appBar: AppBar(),
        body: const EmptyState(
          'Sign-in required',
          'Return to your account to view this order.',
        ),
      );
    }
    final current = order;
    if (current == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Your order')),
        body: error.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : EmptyState(
                'Unable to load order',
                error,
                action: ActionButton('Retry', load),
              ),
      );
    }
    final status = '${current['status']}';
    final paid = current['paymentStatus'] == 'paid';
    final index = stages.indexOf(status);
    final canCancel =
        status == 'pending' &&
        !(paid &&
            current['paymentMethod'] == 'online' &&
            number(current['grandTotal']) > 0);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order details'),
        actions: [
          IconButton(
            tooltip: 'Refresh status',
            onPressed: busy ? null : load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: PageBody(
        children: [
          Heading(
            status == 'delivered'
                ? 'Your coffee has arrived.'
                : status == 'cancelled'
                ? 'Order cancelled.'
                : status == 'shipped'
                ? 'Your coffee is on its way.'
                : status == 'queued'
                ? 'Your coffee is being prepared.'
                : status == 'ready' || status == 'claimed'
                ? 'Your coffee is ready.'
                : current['paymentMethod'] == 'online' && !paid
                ? 'Complete your payment.'
                : 'We received your order.',
            '${current['orderNumber']}',
          ),
          if (error.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(error, style: const TextStyle(color: Colors.red)),
              ),
            ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge(statusLabels[status] ?? status),
              StatusBadge(paymentLabel(current)),
            ],
          ),
          gap(22),
          if (current['paymentMethod'] == 'online' &&
              !paid &&
              status == 'pending') ...[
            const Text(
              'Finish payment on secure PayMongo checkout. Return here afterward; the server verifies payment before preparation.',
            ),
            gap(),
            ActionButton(
              'Continue secure payment',
              openPayment,
              icon: Icons.open_in_new,
            ),
            gap(10),
            OutlinedButton(
              onPressed: busy ? null : load,
              child: const Text('I completed payment - check status'),
            ),
            gap(22),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'YOUR COFFEE',
                    style: TextStyle(
                      letterSpacing: 2,
                      color: sage,
                      fontSize: 11,
                    ),
                  ),
                  gap(),
                  for (final line in rows(current['products'])) ...[
                    Text(
                      '${line['quantity']} x ${line['productName'] ?? obj(line['product'])['name']}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      rows(line['options'])
                          .map((o) => '${o['name']}: ${o['value']}')
                          .join(' / '),
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    for (final extra in rows(line['addons']))
                      Text(
                        '+ ${extra['addonName'] ?? obj(extra['addon'])['name']} x ${extra['quantity']} per item',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                        ),
                      ),
                    gap(12),
                  ],
                  if ('${current['notes'] ?? ''}'.isNotEmpty)
                    Text(
                      'Barista note: ${current['notes']}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  const Divider(),
                  receiptRow('Items', money(current['totalPrice'])),
                  for (final applied in rows(current['vouchersApplied']))
                    receiptRow(
                      'Voucher savings',
                      '- ${money(applied['discountAmount'])}',
                    ),
                  receiptRow('Delivery', 'Free'),
                  receiptRow('Order total', money(current['grandTotal'])),
                  gap(),
                  Text(
                    current['paymentMethod'] == 'cash'
                        ? 'Cash on delivery'
                        : 'Online payment through PayMongo',
                    style: const TextStyle(fontSize: 12, color: sage),
                  ),
                  if (paid && current['paymentReference'] != null)
                    Text(
                      'Reference: ${current['paymentReference']}',
                      style: const TextStyle(fontSize: 11),
                    ),
                  if (paid && current['paidAt'] != null)
                    Text(
                      'Paid: ${dateLabel(current['paidAt'])}',
                      style: const TextStyle(fontSize: 11),
                    ),
                  if (current['paymentAmount'] != null &&
                      current['paymentMethod'] == 'cash')
                    receiptRow(
                      'Cash received',
                      money(current['paymentAmount']),
                    ),
                  if (current['paymentChange'] != null &&
                      current['paymentMethod'] == 'cash')
                    receiptRow('Change', money(current['paymentChange'])),
                ],
              ),
            ),
          ),
          gap(),
          if (status != 'cancelled')
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'FOLLOW YOUR CUP',
                      style: TextStyle(
                        letterSpacing: 2,
                        fontSize: 11,
                        color: sage,
                      ),
                    ),
                    gap(),
                    for (var i = 0; i < stages.length; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 9),
                        child: Row(
                          children: [
                            Icon(
                              i <= index
                                  ? Icons.check_circle
                                  : Icons.radio_button_unchecked,
                              color: i <= index ? sage : Colors.grey,
                              size: 22,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    statusLabels[stages[i]]!,
                                    style: TextStyle(
                                      fontWeight: i == index
                                          ? FontWeight.w600
                                          : FontWeight.normal,
                                    ),
                                  ),
                                  if (current[stageTimes[i]] != null)
                                    Text(
                                      dateLabel(current[stageTimes[i]]),
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: Colors.grey,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          if (status == 'cancelled')
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Reason: ${current['cancellationReason'] ?? 'Order cancelled.'}',
              ),
            ),
          gap(),
          Card(
            child: ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: const Text('Delivery address'),
              subtitle: Text(
                '${addressLabel(obj(current['deliveryAddress']))}\n${obj(current['deliveryAddress'])['riderInstructions'] ?? ''}',
              ),
            ),
          ),
          if (canCancel) ...[
            gap(),
            OutlinedButton(
              onPressed: busy ? null : () => attempt(context, cancelOrder),
              child: const Text('Cancel pending order'),
            ),
          ],
          gap(),
          const Text(
            'For order changes or ingredient questions, contact the shop. Paid online orders require a refund before cancellation.',
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget receiptRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    ),
  );
}

class CancellationDialog extends StatefulWidget {
  const CancellationDialog({super.key});
  @override
  State<CancellationDialog> createState() => _CancellationDialogState();
}

class _CancellationDialogState extends State<CancellationDialog> {
  final reason = TextEditingController();
  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Cancel this order?'),
    content: TextField(
      controller: reason,
      maxLength: 300,
      maxLines: 3,
      decoration: const InputDecoration(labelText: 'Reason for cancellation'),
      onChanged: (_) => setState(() {}),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Keep order'),
      ),
      FilledButton(
        onPressed: reason.text.trim().isEmpty
            ? null
            : () => Navigator.pop(context, reason.text.trim()),
        child: const Text('Confirm cancellation'),
      ),
    ],
  );
}
