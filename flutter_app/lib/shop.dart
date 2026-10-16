import 'package:flutter/material.dart';

import 'core.dart';
import 'ui.dart';
import 'account.dart';
import 'checkout.dart';

void openProduct(BuildContext context, ShopStore store, Json product) =>
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProductScreen(store, '${product['_id']}'),
      ),
    );

class MenuScreen extends StatefulWidget {
  final ShopStore store;
  const MenuScreen(this.store, {super.key});
  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  String query = '', category = 'All', sort = 'Menu order';
  @override
  Widget build(BuildContext context) => RemoteData(
    load: () =>
        widget.store.api.get('/products?status=available&isAddon=false'),
    builder: (data) {
      final products = rows(data);
      final categories = [
        'All',
        ...products.map((p) => '${p['category']}').toSet(),
      ];
      final results = products
          .where(
            (p) =>
                [
                  p['name'],
                  p['description'],
                  p['category'],
                ].join(' ').toLowerCase().contains(query.toLowerCase()) &&
                (category == 'All' || p['category'] == category),
          )
          .toList();
      if (sort == 'Price: low to high') {
        results.sort(
          (a, b) => number(a['price']).compareTo(number(b['price'])),
        );
      } else if (sort == 'Price: high to low') {
        results.sort(
          (a, b) => number(b['price']).compareTo(number(a['price'])),
        );
      }
      return PageBody(
        children: [
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: espresso,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SAMPAGUITA  •  SIGNATURE COLLECTION',
                          style: TextStyle(
                            color: Color(0xffe4d5bc),
                            letterSpacing: 2,
                            fontSize: 10,
                          ),
                        ),
                        gap(12),
                        const Text(
                          'Good days.\nGreat coffee.',
                          style: TextStyle(
                            fontFamily: 'Gilda',
                            fontSize: 36,
                            height: 1.1,
                            color: Colors.white,
                          ),
                        ),
                        gap(12),
                        const Text(
                          'Your coffeehouse favorites,\njust the way you like them.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
                if (MediaQuery.sizeOf(context).width > 440)
                  SizedBox(
                    width: 190,
                    height: 230,
                    child: Image.asset(
                      'assets/sampaguita/flower.png',
                      fit: BoxFit.cover,
                    ),
                  ),
              ],
            ),
          ),
          gap(24),
          const Heading(
            'The signature collection.',
            'Find something beautiful for someone special.',
          ),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'What are you looking for?',
            ),
            onChanged: (value) => setState(() => query = value),
          ),
          gap(),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories
                .map(
                  (value) => ChoiceChip(
                    label: Text(value),
                    selected: category == value,
                    onSelected: (_) => setState(() => category = value),
                  ),
                )
                .toList(),
          ),
          gap(),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${results.length} items to explore',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              DropdownButton<String>(
                value: sort,
                items:
                    ['Menu order', 'Price: low to high', 'Price: high to low']
                        .map(
                          (v) => DropdownMenuItem(
                            value: v,
                            child: Text(
                              v,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        )
                        .toList(),
                onChanged: (value) => setState(() => sort = value!),
              ),
            ],
          ),
          gap(),
          if (results.isEmpty)
            const EmptyState(
              'No items found.',
              'Try a different search or category.',
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth < 480
                    ? 1
                    : constraints.maxWidth < 820
                    ? 2
                    : 3;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisExtent: 365,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: results.length,
                  itemBuilder: (context, index) =>
                      ProductCard(widget.store, results[index]),
                );
              },
            ),
          gap(20),
          const Text(
            'Explore the collection and review your selections before checkout.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ],
      );
    },
  );
}

class ProductCard extends StatelessWidget {
  final ShopStore store;
  final Json product;
  const ProductCard(this.store, this.product, {super.key});
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => openProduct(context, store, product),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CoffeeImage(product, height: 180),
            gap(12),
            Text(
              '${product['category']}',
              style: const TextStyle(color: sage, fontSize: 10),
            ),
            gap(4),
            Text(
              '${product['name']}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontFamily: 'Gilda', fontSize: 23),
            ),
            gap(5),
            Text(
              '${product['description']}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            const Spacer(),
            Row(
              children: [
                Text(
                  'From ${money(product['price'])}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                const Icon(Icons.arrow_forward, size: 19, color: espresso),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class ProductScreen extends StatefulWidget {
  final ShopStore store;
  final String id;
  const ProductScreen(this.store, this.id, {super.key});
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final Map<String, String> choices = {};
  final Map<String, int> additions = {};
  int quantity = 1;
  Future<Json> load() async => {
    'product': await widget.store.api.get('/products/${widget.id}'),
    'extras': await widget.store.api.get(
      '/products?status=available&isAddon=true',
    ),
  };
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Make it yours')),
    body: RemoteData(
      load: load,
      builder: (data) {
        final product = obj(data['product']);
        final extras = rows(data['extras']);
        final groups = rows(product['optionGroups']);
        final rules = rows(product['allowedAddons']);
        for (final group in groups) {
          final values = rows(group['choices']);
          if (values.isNotEmpty) {
            choices.putIfAbsent(
              '${group['name']}',
              () => '${values.first['label']}',
            );
          }
        }
        for (final rule in rules) {
          final id = '${obj(rule['addon'])['_id'] ?? rule['addon']}';
          additions.putIfAbsent(id, () => number(rule['minQuantity']).toInt());
        }
        final options = choices.entries
            .map((e) => <String, dynamic>{'name': e.key, 'value': e.value})
            .toList();
        final selected = extras
            .where((e) => (additions['${e['_id']}'] ?? 0) > 0)
            .map(
              (e) => <String, dynamic>{
                ...e,
                'quantity': additions['${e['_id']}'],
              },
            )
            .toList();
        final line = BagLine(product, options, selected, quantity: quantity);
        final available =
            product['status'] == 'available' && number(product['stock']) > 0;
        final validExtras = rules.every((rule) {
          final id = '${obj(rule['addon'])['_id'] ?? rule['addon']}';
          final count = additions[id] ?? 0;
          final matches = extras.where((e) => e['_id'] == id);
          return count == 0 ||
              (matches.isNotEmpty &&
                  number(matches.first['stock']) >= count * quantity);
        });
        return PageBody(
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final image = CoffeeImage(
                  product,
                  height: constraints.maxWidth > 700 ? 470 : 300,
                );
                final info = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${product['category']}',
                      style: const TextStyle(
                        color: sage,
                        letterSpacing: 1.5,
                        fontSize: 11,
                      ),
                    ),
                    gap(10),
                    Text(
                      '${product['name']}',
                      style: const TextStyle(fontFamily: 'Gilda', fontSize: 36),
                    ),
                    gap(),
                    Text(
                      money(product['price']),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    gap(),
                    StatusBadge(
                      available
                          ? 'Available to order'
                          : 'Currently unavailable',
                    ),
                    gap(),
                    Text(
                      '${product['description']}',
                      style: const TextStyle(
                        height: 1.7,
                        color: Color(0xff827365),
                      ),
                    ),
                  ],
                );
                return constraints.maxWidth > 700
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: image),
                          const SizedBox(width: 32),
                          Expanded(child: info),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [image, gap(24), info],
                      );
              },
            ),
            gap(26),
            for (final group in groups) ...[
              Text(
                '${group['name']}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              gap(8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: rows(group['choices'])
                    .map(
                      (choice) => ChoiceChip(
                        label: Text(
                          '${choice['label']}${number(choice['priceAdjustment']) > 0 ? ' +${money(choice['priceAdjustment'])}' : ''}',
                        ),
                        selected:
                            choices['${group['name']}'] == choice['label'],
                        onSelected: (_) => setState(
                          () => choices['${group['name']}'] =
                              '${choice['label']}',
                        ),
                      ),
                    )
                    .toList(),
              ),
              gap(20),
            ],
            if (rules.isNotEmpty)
              const Heading(
                'A little extra?',
                'Optional extras are priced per coffee.',
              ),
            for (final rule in rules)
              Builder(
                builder: (context) {
                  final id = '${obj(rule['addon'])['_id'] ?? rule['addon']}';
                  final found = extras.where((e) => e['_id'] == id);
                  final extra = found.isEmpty
                      ? obj(rule['addon'])
                      : found.first;
                  final count = additions[id] ?? 0;
                  return Card(
                    child: ListTile(
                      title: Text('${extra['name'] ?? 'Unavailable extra'}'),
                      subtitle: Text('${money(extra['price'])} each'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: 'Remove extra',
                            onPressed: count > number(rule['minQuantity'])
                                ? () =>
                                      setState(() => additions[id] = count - 1)
                                : null,
                            icon: const Icon(Icons.remove),
                          ),
                          Text('$count'),
                          IconButton(
                            tooltip: 'Add extra',
                            onPressed:
                                found.isNotEmpty &&
                                    count < number(rule['maxQuantity'])
                                ? () =>
                                      setState(() => additions[id] = count + 1)
                                : null,
                            icon: const Icon(Icons.add),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            gap(),
            Row(
              children: [
                const Text('Quantity'),
                const Spacer(),
                IconButton(
                  tooltip: 'Decrease quantity',
                  onPressed: quantity > 1
                      ? () => setState(() => quantity--)
                      : null,
                  icon: const Icon(Icons.remove),
                ),
                Text('$quantity'),
                IconButton(
                  tooltip: 'Increase quantity',
                  onPressed: quantity < number(product['stock'])
                      ? () => setState(() => quantity++)
                      : null,
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            gap(),
            Row(
              children: [
                const Text('Your selection'),
                const Spacer(),
                Text(
                  money(line.total),
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            gap(),
            if (!validExtras)
              const Text(
                'An extra does not have enough stock for this quantity.',
                style: TextStyle(color: Colors.red),
              ),
            if (available && validExtras)
              ActionButton('Add to bag', () async {
                await widget.store.add(line);
                if (context.mounted) {
                  notice(context, 'Added to your bag.');
                  Navigator.pop(context);
                }
              }, icon: Icons.shopping_bag_outlined),
            gap(),
            OutlinedButton.icon(
              onPressed: () => attempt(context, () async {
                await widget.store.toggleFavorite(product);
                if (mounted) setState(() {});
              }),
              icon: Icon(
                widget.store.favorites.any((p) => p['_id'] == product['_id'])
                    ? Icons.favorite
                    : Icons.favorite_border,
              ),
              label: const Text('Save to favorites'),
            ),
            gap(),
            const Text(
              'For ingredient or allergy questions, contact the shop before ordering.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        );
      },
    ),
  );
}

class FavoritesScreen extends StatelessWidget {
  final ShopStore store;
  const FavoritesScreen(this.store, {super.key});
  @override
  Widget build(BuildContext context) => store.favorites.isEmpty
      ? const EmptyState(
          'Your favorites, all here.',
          'Tap the heart on a coffee to save it for your next break.',
        )
      : PageBody(
          children: [
            const Heading(
              'Your usuals.',
              'A little collection of cups you love.',
            ),
            for (final product in store.favorites)
              Card(
                child: ListTile(
                  leading: SizedBox(
                    width: 58,
                    child: CoffeeImage(product, height: 58),
                  ),
                  title: Text('${product['name']}'),
                  subtitle: Text(money(product['price'])),
                  onTap: () => openProduct(context, store, product),
                  trailing: IconButton(
                    tooltip: 'Remove favorite',
                    onPressed: () =>
                        attempt(context, () => store.toggleFavorite(product)),
                    icon: const Icon(Icons.favorite, color: espresso),
                  ),
                ),
              ),
          ],
        );
}

class BagScreen extends StatelessWidget {
  final ShopStore store;
  const BagScreen(this.store, {super.key});
  @override
  Widget build(BuildContext context) => PageBody(
    children: [
      const Heading(
        'A good day, in your bag.',
        'Your favorites, just the way you like them.',
      ),
      if (store.bag.isEmpty)
        const EmptyState(
          'Your next coffee break starts here.',
          'Browse the menu and add a comforting classic.',
        )
      else ...[
        for (final line in store.bag)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 85,
                        child: CoffeeImage(line.product, height: 90),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${line.product['name']}',
                              style: const TextStyle(
                                fontFamily: 'Gilda',
                                fontSize: 23,
                              ),
                            ),
                            gap(5),
                            Text(
                              line.description,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.grey,
                              ),
                            ),
                            gap(8),
                            Text(
                              money(line.total),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Decrease quantity',
                        onPressed: () => attempt(
                          context,
                          () => store.setQuantity(line, line.quantity - 1),
                        ),
                        icon: const Icon(Icons.remove),
                      ),
                      Text('${line.quantity}'),
                      IconButton(
                        tooltip: 'Increase quantity',
                        onPressed: line.quantity < number(line.product['stock'])
                            ? () => attempt(
                                context,
                                () =>
                                    store.setQuantity(line, line.quantity + 1),
                              )
                            : null,
                        icon: const Icon(Icons.add),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () =>
                            attempt(context, () => store.setQuantity(line, 0)),
                        child: const Text('Remove'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        gap(),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              children: [
                Row(
                  children: [
                    const Text('Estimated subtotal'),
                    const Spacer(),
                    Text(
                      money(store.subtotal),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                gap(),
                const Text(
                  'Current prices, stock, vouchers and delivery are confirmed at checkout.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                gap(20),
                SizedBox(
                  width: double.infinity,
                  child: ActionButton(
                    store.signedIn
                        ? 'Continue to checkout'
                        : 'Sign in to checkout',
                    () async {
                      final allowed = await requireCustomer(context, store);
                      if (context.mounted && allowed) {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CheckoutScreen(store),
                          ),
                        );
                      }
                    },
                    icon: Icons.arrow_forward,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ],
  );
}
