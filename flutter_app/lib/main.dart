import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/semantics.dart';

import 'core.dart';
import 'ui.dart';
import 'shop.dart';
import 'orders.dart';
import 'account.dart';
import 'notifications.dart';

SemanticsHandle? webSemantics;
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) webSemantics = SemanticsBinding.instance.ensureSemantics();
  final store = ShopStore();
  runApp(KapeApp(store: store));
  unawaited(store.initialize());
}

class KapeApp extends StatelessWidget {
  final ShopStore store;
  const KapeApp({super.key, required this.store});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Sampaguita',
    debugShowCheckedModeBanner: false,
    theme: coffeeTheme(),
    home: AnimatedBuilder(
      animation: store,
      builder: (context, _) => store.ready
          ? HomeShell(store: store)
          : const Scaffold(body: Center(child: CircularProgressIndicator())),
    ),
  );
}

class HomeShell extends StatefulWidget {
  final ShopStore store;
  const HomeShell({super.key, required this.store});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int selected = 0;
  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final destinations = [
      const NavigationDestination(
        icon: Icon(Icons.local_florist_outlined),
        selectedIcon: Icon(Icons.local_florist),
        label: 'Shop Here',
      ),
      const NavigationDestination(
        icon: Icon(Icons.favorite_border),
        selectedIcon: Icon(Icons.favorite),
        label: 'Favorites',
      ),
      NavigationDestination(
        icon: Badge(
          isLabelVisible: store.count > 0,
          label: Text('${store.count}'),
          child: const Icon(Icons.shopping_bag_outlined),
        ),
        label: 'Cart',
      ),
      const NavigationDestination(
        icon: Icon(Icons.receipt_long_outlined),
        label: 'Orders',
      ),
      const NavigationDestination(
        icon: Icon(Icons.person_outline),
        label: 'Account',
      ),
    ];
    final pages = [
      MenuScreen(store),
      FavoritesScreen(store),
      BagScreen(store),
      OrdersScreen(store),
      AccountScreen(store),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            SizedBox(
              height: 42,
              width: 54,
              child: Image(image: AssetImage('assets/sampaguita/logo_a.png'), fit: BoxFit.contain),
            ),
            SizedBox(width: 8),
            Text('Sampaguita', style: TextStyle(fontFamily: 'Gilda', fontSize: 27, color: espresso)),
          ],
        ),
        actions: [
          if (store.signedIn)
            NotificationsBell(store, key: ValueKey(store.scope)),
          IconButton(
            tooltip: 'Contact the shop',
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => ContactScreen(store))),
            icon: const Icon(Icons.chat_bubble_outline),
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/sampaguita/background.png', fit: BoxFit.cover),
          const ColoredBox(color: Color(0x33f6e9db)),
          LayoutBuilder(
        builder: (context, constraints) => Row(
          children: [
            if (constraints.maxWidth >= 850)
              NavigationRail(
                selectedIndex: selected,
                onDestinationSelected: (i) => setState(() => selected = i),
                labelType: NavigationRailLabelType.all,
                destinations: destinations
                    .map(
                      (d) => NavigationRailDestination(
                        icon: d.icon,
                        label: Text(d.label),
                      ),
                    )
                    .toList(),
              ),
            Expanded(
              child: Column(
                children: [
                  if (store.startupError != null)
                    MaterialBanner(
                      content: Text(store.startupError!),
                      actions: [
                        TextButton(
                          onPressed: () =>
                              setState(() => store.startupError = null),
                          child: const Text('Dismiss'),
                        ),
                      ],
                    ),
                  Expanded(
                    child: KeyedSubtree(
                      key: ValueKey(selected),
                      child: pages[selected],
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
      bottomNavigationBar: MediaQuery.sizeOf(context).width < 850
          ? NavigationBar(
              selectedIndex: selected,
              onDestinationSelected: (i) => setState(() => selected = i),
              destinations: destinations,
            )
          : null,
    );
  }
}
