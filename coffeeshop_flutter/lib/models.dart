class CoffeeProduct {
  final String id, name, description, category, image, status;
  final double price;
  final int stock;
  final bool isAddon;
  CoffeeProduct.fromJson(Map<String, dynamic> j)
    : id = (j['_id'] ?? '').toString(),
      name = (j['name'] ?? 'Coffee').toString(),
      description = (j['description'] ?? 'Freshly made for you.').toString(),
      category = (j['category'] ?? 'Coffee').toString(),
      image = (j['image'] ?? '').toString(),
      status = (j['status'] ?? 'available').toString(),
      price = (j['price'] as num? ?? 0).toDouble(),
      stock = (j['stock'] as num? ?? 0).toInt(),
      isAddon = j['isAddon'] == true;
  bool get available => status == 'available' && stock > 0;
}

class CartLine {
  final CoffeeProduct product;
  int quantity;
  CartLine(this.product, [this.quantity = 1]);
  double get total => product.price * quantity;
}
