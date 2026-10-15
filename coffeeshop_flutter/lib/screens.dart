import 'package:flutter/material.dart';
import 'api.dart';
import 'models.dart';

const _coffee = Color(0xFF6F432B);
const _ink = Color(0xFF38251B);
String peso(num n) => '₱${n.toStringAsFixed(2)}';
String messageOf(Object e) => e.toString().replaceFirst('Exception: ', '');

class ShopShell extends StatefulWidget {
  const ShopShell({super.key});
  @override
  State<ShopShell> createState() => _ShopShellState();
}

class _ShopShellState extends State<ShopShell> {
  int tab = 0;
  final cart = <String, CartLine>{};
  List<CoffeeProduct> products = [];
  bool loading = true;
  String? userName, userEmail, role;
  List<dynamic> orders = [];
  @override
  void initState() {
    super.initState();
    loadProducts();
  }

  Future<void> loadProducts() async {
    setState(() => loading = true);
    try {
      final d = await CoffeeApi.request(
        '/products?status=available&isAddon=false',
      );
      final raw = d['payload'];
      final list = raw is List
          ? raw
          : (raw is Map && raw['products'] is List
                ? raw['products'] as List
                : <dynamic>[]);
      products = list
          .whereType<Map<String, dynamic>>()
          .map(CoffeeProduct.fromJson)
          .where((p) => !p.isAddon)
          .toList();
    } catch (e) {
      if (mounted) _snack(messageOf(e));
    }
    if (mounted) setState(() => loading = false);
  }

  void _snack(String s) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  }

  int get count => cart.values.fold(0, (n, l) => n + l.quantity);
  double get total => cart.values.fold(0, (n, l) => n + l.total);
  void add(CoffeeProduct p) {
    setState(() {
      final line = cart[p.id];
      if (line != null) {
        if (line.quantity < p.stock) line.quantity++;
      } else {
        cart[p.id] = CartLine(p);
      }
    });
    _snack('${p.name} added to your cart');
  }

  Future<void> loadOrders() async {
    try {
      final d = await CoffeeApi.request('/orders/mine');
      final p = d['payload'];
      if (mounted) setState(() => orders = p is List ? p : []);
    } catch (e) {
      _snack(messageOf(e));
    }
  }

  void login(Map<String, dynamic> payload) {
    final u = payload['user'] is Map
        ? Map<String, dynamic>.from(payload['user'])
        : payload;
    setState(() {
      userName = '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim();
      userEmail = (u['email'] ?? '').toString();
      role = (u['role'] ?? 'customer').toString();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[_home(), _cart(), _account(), _orders()];
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.coffee, color: _coffee, size: 28),
            const SizedBox(width: 9),
            const Text(
              'Brew & Bean',
              style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -.5),
            ),
            const Spacer(),
            IconButton(
              onPressed: loadProducts,
              icon: const Icon(Icons.refresh),
            ),
            Badge(
              label: Text('$count'),
              child: IconButton(
                onPressed: () => setState(() => tab = 1),
                icon: const Icon(Icons.shopping_bag_outlined),
              ),
            ),
          ],
        ),
      ),
      body: IndexedStack(index: tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.coffee_outlined),
            selectedIcon: Icon(Icons.coffee),
            label: 'Menu',
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_cart_outlined),
            selectedIcon: Icon(Icons.shopping_cart),
            label: 'Cart',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Account',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Orders',
          ),
        ],
      ),
    );
  }

  Widget _home() => RefreshIndicator(
    onRefresh: loadProducts,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: _ink,
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(
              colors: [Color(0xFF38251B), Color(0xFF875B3E)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'YOUR DAILY\nCUP OF COMFORT',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 27,
                  fontWeight: FontWeight.w900,
                  height: 1.12,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Good coffee. Good mood. Great day.',
                style: TextStyle(color: Color(0xFFEADACB), fontSize: 14),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () => _scrollToMenu(),
                icon: const Icon(Icons.local_cafe),
                label: const Text('Explore the menu'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFF4E5D4),
                  foregroundColor: _ink,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            const Expanded(
              child: Text(
                'Made for your moment',
                style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                  color: _ink,
                ),
              ),
            ),
            Text(
              '${products.length} drinks & bites',
              style: const TextStyle(color: Colors.brown),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (loading)
          const Padding(
            padding: EdgeInsets.all(35),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (products.isEmpty)
          _empty(
            'No products to show yet',
            'Add available coffee shop products in the backend, then refresh.',
            Icons.coffee,
          ),
        ...products.map(_productCard),
      ],
    ),
  );
  void _scrollToMenu() {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Your menu is right below ☕')));
  }

  Widget _productCard(CoffeeProduct p) => Container(
    margin: const EdgeInsets.only(bottom: 13),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFEFE5DA)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 94,
          height: 104,
          decoration: BoxDecoration(
            color: const Color(0xFFF0E3D5),
            borderRadius: BorderRadius.circular(15),
          ),
          clipBehavior: Clip.antiAlias,
          child: p.image.startsWith('http')
              ? Image.network(
                  p.image,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      const Icon(Icons.coffee, size: 42, color: _coffee),
                )
              : const Icon(Icons.coffee, size: 42, color: _coffee),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                p.category.toUpperCase(),
                style: const TextStyle(
                  color: _coffee,
                  fontSize: 10,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                p.name,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: _ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                p.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.brown.shade400, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    peso(p.price),
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: _coffee,
                    ),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: p.available ? () => add(p) : null,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(44, 36),
                      padding: const EdgeInsets.symmetric(horizontal: 13),
                    ),
                    child: const Icon(Icons.add),
                  ),
                ],
              ),
              if (!p.available)
                const Text(
                  'Currently unavailable',
                  style: TextStyle(color: Colors.red, fontSize: 11),
                ),
            ],
          ),
        ),
      ],
    ),
  );
  Widget _cart() => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      const Text(
        'Your cart',
        style: TextStyle(
          fontSize: 27,
          fontWeight: FontWeight.w900,
          color: _ink,
        ),
      ),
      const SizedBox(height: 5),
      Text(
        '$count item${count == 1 ? '' : 's'} waiting to be brewed',
        style: TextStyle(color: Colors.brown.shade400),
      ),
      const SizedBox(height: 18),
      if (cart.isEmpty)
        _empty(
          'Your cart is taking a coffee break',
          'Add something delicious from the menu.',
          Icons.shopping_bag_outlined,
        )
      else ...[
        ...cart.values.map(
          (l) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFF0E3D5),
                  child: Icon(Icons.coffee, color: _coffee),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l.product.name,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        peso(l.product.price),
                        style: const TextStyle(color: _coffee),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => setState(
                    () => l.quantity > 1
                        ? l.quantity--
                        : cart.remove(l.product.id),
                  ),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('${l.quantity}'),
                IconButton(
                  onPressed: () => setState(
                    () => l.quantity < l.product.stock ? l.quantity++ : null,
                  ),
                  icon: const Icon(Icons.add_circle_outline),
                ),
                Text(
                  peso(l.total),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ),
        const Divider(height: 28),
        _summaryRow('Subtotal', peso(total)),
        _summaryRow('Delivery fee', 'Calculated by shop'),
        const SizedBox(height: 16),
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            onPressed: () => _checkout(),
            icon: const Icon(Icons.lock_outline),
            label: Text('Checkout • ${peso(total)}'),
          ),
        ),
        TextButton(
          onPressed: () => setState(cart.clear),
          child: const Text('Clear cart'),
        ),
      ],
    ],
  );
  Widget _summaryRow(String a, String b) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Expanded(
          child: Text(a, style: TextStyle(color: Colors.brown.shade500)),
        ),
        Text(b, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
  Future<void> _checkout() async {
    if (CoffeeApi.token == null) {
      _snack('Please log in as a customer before checking out.');
      setState(() => tab = 2);
      return;
    }
    final form = GlobalKey<FormState>();
    final controllers = List.generate(8, (_) => TextEditingController());
    String payment = 'cash';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, ss) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Form(
            key: form,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Delivery details',
                    style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  const Text('Enter a valid address so your coffee finds you.'),
                  ...List.generate(
                    8,
                    (i) => Padding(
                      padding: const EdgeInsets.only(top: 9),
                      child: TextFormField(
                        controller: controllers[i],
                        keyboardType: i < 2
                            ? const TextInputType.numberWithOptions(
                                decimal: true,
                              )
                            : TextInputType.text,
                        decoration: InputDecoration(
                          labelText: [
                            'Latitude',
                            'Longitude',
                            'Building / lot',
                            'Street',
                            'Barangay',
                            'City',
                            'Province',
                            'ZIP code',
                          ][i],
                        ),
                        validator: (v) =>
                            v == null || v.trim().isEmpty ? 'Required' : null,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: payment,
                    decoration: const InputDecoration(
                      labelText: 'Payment method',
                    ),
                    items: const [
                      DropdownMenuItem(value: 'cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'card', child: Text('Card')),
                      DropdownMenuItem(value: 'online', child: Text('Online')),
                    ],
                    onChanged: (v) => ss(() => payment = v ?? 'cash'),
                  ),
                  const SizedBox(height: 15),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => form.currentState!.validate()
                          ? Navigator.pop(ctx, true)
                          : null,
                      child: Text('Place order • ${peso(total)}'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (ok != true) return;
    try {
      await CoffeeApi.request(
        '/orders',
        method: 'POST',
        body: {
          'paymentMethod': payment,
          'deliveryAddress': {
            'latitude': double.parse(controllers[0].text),
            'longitude': double.parse(controllers[1].text),
            'apartmentBuildingLotNumber': controllers[2].text,
            'street': controllers[3].text,
            'barangay': controllers[4].text,
            'city': controllers[5].text,
            'province': controllers[6].text,
            'zipCode': controllers[7].text,
          },
          'products': cart.values
              .map(
                (l) => {
                  'product': l.product.id,
                  'quantity': l.quantity,
                  'addons': [],
                },
              )
              .toList(),
        },
      );
      if (mounted) {
        setState(cart.clear);
        _snack('Order placed! Check Orders for updates.');
        await loadOrders();
        setState(() => tab = 3);
      }
    } catch (e) {
      _snack(messageOf(e));
    }
  }

  Widget _account() => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      const Text(
        'Your account',
        style: TextStyle(
          fontSize: 27,
          fontWeight: FontWeight.w900,
          color: _ink,
        ),
      ),
      const SizedBox(height: 16),
      if (CoffeeApi.token == null) ...[
        const Text(
          'Welcome back',
          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        const Text('Sign in to place orders and track your coffee.'),
        const SizedBox(height: 18),
        _AuthForm(
          onSuccess: (d) {
            final p = d['payload'];
            if (p is Map) {
              CoffeeApi.token = (p['token'] ?? '').toString();
              login(Map<String, dynamic>.from(p));
            }
            setState(() {});
            loadOrders();
            _snack('Signed in successfully');
          },
        ),
        const SizedBox(height: 22),
        const Divider(),
        const SizedBox(height: 12),
        const Text(
          'New around here?',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        const SizedBox(height: 8),
        _RegisterForm(
          onSuccess: () {
            _snack('Account created. Please sign in.');
          },
        ),
      ] else
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF0E3D5),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              const CircleAvatar(
                radius: 28,
                backgroundColor: _coffee,
                child: Icon(Icons.person, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      userName?.isNotEmpty == true
                          ? userName!
                          : 'Coffee lover',
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      userEmail ?? '',
                      style: const TextStyle(color: _coffee),
                    ),
                    Text(
                      role ?? 'customer',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        ListTile(
          leading: const Icon(Icons.receipt_long),
          title: const Text('My orders'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            loadOrders();
            setState(() => tab = 3);
          },
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Sign out'),
          onTap: () {
            setState(() {
              CoffeeApi.token = null;
              userName = null;
              userEmail = null;
              role = null;
              orders = [];
            });
            _snack('Signed out');
          },
        ),
      ],
  );
  Widget _orders() => RefreshIndicator(
    onRefresh: loadOrders,
    child: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text(
          'Order history',
          style: TextStyle(
            fontSize: 27,
            fontWeight: FontWeight.w900,
            color: _ink,
          ),
        ),
        const SizedBox(height: 12),
        if (CoffeeApi.token == null)
          _empty(
            'Sign in to see your orders',
            'Your recent purchases will appear here.',
            Icons.receipt_long,
          )
        else if (orders.isEmpty)
          _empty(
            'No orders yet',
            'Your first coffee adventure is just a few taps away.',
            Icons.coffee,
          )
        else
          ...orders.map((o) {
            final m = o is Map ? o : <String, dynamic>{};
            final id = (m['orderNumber'] ?? m['_id'] ?? 'Order').toString();
            return Card(
              color: Colors.white,
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF0E3D5),
                  child: Icon(Icons.coffee, color: _coffee),
                ),
                title: Text(
                  id,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${m['status'] ?? 'pending'} • ${m['paymentStatus'] ?? 'pending'}',
                ),
                trailing: Text(
                  peso((m['grandTotal'] as num? ?? 0)),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            );
          }),
      ],
    ),
  );
  Widget _empty(String title, String subtitle, IconData icon) => Container(
    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      children: [
        Icon(icon, size: 45, color: _coffee),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.brown.shade400),
        ),
      ],
    ),
  );
}

class _AuthForm extends StatefulWidget {
  final void Function(Map<String, dynamic>) onSuccess;
  const _AuthForm({required this.onSuccess});
  @override
  State<_AuthForm> createState() => _AuthFormState();
}

class _AuthFormState extends State<_AuthForm> {
  final form = GlobalKey<FormState>();
  final identity = TextEditingController(), password = TextEditingController();
  bool busy = false, show = false;
  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final d = await CoffeeApi.request(
        '/auth/login',
        method: 'POST',
        body: {'email': identity.text.trim(), 'password': password.text},
      );
      widget.onSuccess(d);
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(messageOf(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      children: [
        TextFormField(
          controller: identity,
          decoration: const InputDecoration(
            labelText: 'Email, username or phone',
            prefixIcon: Icon(Icons.person_outline),
          ),
          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: password,
          obscureText: !show,
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              onPressed: () => setState(() => show = !show),
              icon: Icon(show ? Icons.visibility_off : Icons.visibility),
            ),
          ),
          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          height: 49,
          child: FilledButton(
            onPressed: busy ? null : submit,
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Sign in'),
          ),
        ),
      ],
    ),
  );
}

class _RegisterForm extends StatefulWidget {
  final VoidCallback onSuccess;
  const _RegisterForm({required this.onSuccess});
  @override
  State<_RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<_RegisterForm> {
  final form = GlobalKey<FormState>();
  final first = TextEditingController(),
      last = TextEditingController(),
      phone = TextEditingController(),
      address = TextEditingController(),
      email = TextEditingController(),
      password = TextEditingController();
  bool busy = false;
  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final username =
          '${email.text.split('@').first}_${DateTime.now().millisecondsSinceEpoch % 1000000}';
      await CoffeeApi.request(
        '/auth/register-customer',
        method: 'POST',
        body: {
          'firstName': first.text.trim(),
          'lastName': last.text.trim(),
          'contactNumber': phone.text.trim(),
          'homeAddress': address.text.trim(),
          'username': username,
          'email': email.text.trim(),
          'password': password.text,
        },
      );
      widget.onSuccess();
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(messageOf(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Form(
    key: form,
    child: Column(
      children: [
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: first,
                decoration: const InputDecoration(labelText: 'First name'),
                validator: _required,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                controller: last,
                decoration: const InputDecoration(labelText: 'Last name'),
                validator: _required,
              ),
            ),
          ],
        ),
        const SizedBox(height: 9),
        TextFormField(
          controller: phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'Phone number (09… or +639…)',
          ),
          validator: (v) {
            if (v == null || !RegExp(r'^(?:\+63|0)9\d{9}$').hasMatch(v.trim()))
              return 'Use a valid Philippine mobile number';
            return null;
          },
        ),
        const SizedBox(height: 9),
        TextFormField(
          controller: address,
          decoration: const InputDecoration(
            labelText: 'Home address (optional)',
          ),
        ),
        const SizedBox(height: 9),
        TextFormField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email address'),
          validator: (v) => v == null || !v.contains('@') || !v.contains('.')
              ? 'Enter a valid email'
              : null,
        ),
        const SizedBox(height: 9),
        TextFormField(
          controller: password,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Password (8+ characters)',
          ),
          validator: (v) =>
              v == null || v.length < 8 ? 'Use at least 8 characters' : null,
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton(
            onPressed: busy ? null : submit,
            child: Text(busy ? 'Creating account…' : 'Create customer account'),
          ),
        ),
      ],
    ),
  );
  String? _required(String? v) =>
      v == null || v.trim().isEmpty ? 'Required' : null;
}
