import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

typedef Json = Map<String, dynamic>;
Json obj(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : {};
List<Json> rows(dynamic value) => value is List ? value.map(obj).toList() : [];
double number(dynamic value) => double.tryParse('$value') ?? 0;
String money(dynamic value) => '\u20b1${number(value).toStringAsFixed(2)}';
const statusLabels = {
  'pending': 'Order received',
  'confirmed': 'Accepted',
  'queued': 'Preparing',
  'ready': 'Ready for rider',
  'claimed': 'Rider assigned',
  'shipped': 'Out for delivery',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
};
const stages = [
  'pending',
  'confirmed',
  'queued',
  'ready',
  'claimed',
  'shipped',
  'delivered',
];
const stageTimes = [
  'createdAt',
  'confirmedAt',
  'queuedAt',
  'readyAt',
  'claimedAt',
  'shippedAt',
  'deliveredAt',
];
String paymentLabel(Json order) => order['paymentStatus'] == 'refunded'
    ? 'Refunded'
    : order['paymentStatus'] == 'paid'
    ? 'Paid'
    : order['status'] == 'cancelled'
    ? 'No payment due'
    : order['paymentStatus'] == 'failed'
    ? 'Payment failed'
    : order['paymentMethod'] == 'cash'
    ? 'Cash due on delivery'
    : 'Awaiting online payment';
String addressLabel(Json address) => [
  'apartmentBuildingLotNumber',
  'street',
  'barangay',
  'city',
  'province',
  'zipCode',
].map((key) => '${address[key] ?? ''}').where((v) => v.isNotEmpty).join(', ');
String dateLabel(dynamic value) {
  final date = DateTime.tryParse('$value')
      ?.toUtc()
      .add(const Duration(hours: 8));
  if (date == null) return '';
  return '${date.month}/${date.day}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')} PHT';
}

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

class Api {
  static String get base {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured.replaceAll(RegExp(r'/$'), '');
    return !kIsWeb && defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:5000/api'
        : 'http://localhost:5000/api';
  }

  String? token;
  final http.Client client;
  Api({http.Client? client}) : client = client ?? http.Client();
  Future<Json> request(String path, {String method = 'GET', Json? body}) async {
    try {
      final request = http.Request(method, Uri.parse('$base$path'));
      request.headers.addAll({
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      });
      if (body != null) request.body = jsonEncode(body);
      final response = await http.Response.fromStream(
        await client.send(request).timeout(const Duration(seconds: 20)),
      );
      Json result = {};
      try {
        result = obj(jsonDecode(response.body));
      } catch (_) {
        throw ApiException(
          'The server returned an unreadable response.',
          response.statusCode,
        );
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          '${result['message'] ?? 'Request failed. Please try again.'}',
          response.statusCode,
        );
      }
      return result;
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'Unable to reach the coffee shop. Check your connection and try again.',
      );
    }
  }

  Future<dynamic> get(String path) async => (await request(path))['payload'];
  Future<dynamic> post(String path, Json body) async =>
      (await request(path, method: 'POST', body: body))['payload'];
}

class BagLine {
  final Json product;
  final List<Json> options;
  final List<Json> extras;
  int quantity;
  BagLine(this.product, this.options, this.extras, {this.quantity = 1});
  String get id => '${product['_id']}';
  String get key {
    final choices = options.map((o) => '${o['name']}:${o['value']}').toList()
      ..sort();
    final additions = extras.map((o) => '${o['_id']}:${o['quantity']}').toList()
      ..sort();
    return jsonEncode([id, choices, additions]);
  }

  double get unitPrice {
    double adjustment = 0;
    for (final group in rows(product['optionGroups'])) {
      for (final option in options.where((o) => o['name'] == group['name'])) {
        final choice = rows(group['choices'])
            .where((c) => c['label'] == option['value']);
        if (choice.isNotEmpty) {
          adjustment += number(choice.first['priceAdjustment']);
        }
      }
    }
    return number(product['price']) +
        adjustment +
        extras.fold<double>(
          0,
          (sum, e) => sum + number(e['price']) * number(e['quantity']),
        );
  }

  double get total => unitPrice * quantity;
  String get description => [
    ...options.map((o) => '${o['name']}: ${o['value']}'),
    ...extras.map((e) => '${e['name']} x${e['quantity']}'),
  ].join(' / ');
  Json get payload => {
    'product': id,
    'quantity': quantity,
    'options': options,
    'addons': extras
        .map((e) => {'addon': e['_id'], 'quantity': e['quantity']})
        .toList(),
  };
  Json toJson() => {
    'product': product,
    'options': options,
    'extras': extras,
    'quantity': quantity,
  };
  factory BagLine.fromJson(Json value) => BagLine(
    obj(value['product']),
    rows(value['options']),
    rows(value['extras']),
    quantity: number(value['quantity']).toInt().clamp(1, 999),
  );
}

class ShopStore extends ChangeNotifier {
  final Api api;
  final FlutterSecureStorage secure;
  SharedPreferences? preferences;
  Json? user;
  List<BagLine> bag = [];
  List<Json> favorites = [];
  Json address = {};
  bool ready = false;
  String? startupError;
  ShopStore({Api? api, FlutterSecureStorage? secure})
    : api = api ?? Api(),
      secure = secure ?? const FlutterSecureStorage();
  bool get signedIn => user != null && api.token != null;
  String get scope => signedIn ? 'customer:${user!['_id']}' : 'guest';
  String storageKey(String key) => 'kapeco:$scope:$key';
  int get count => bag.fold(0, (sum, line) => sum + line.quantity);
  double get subtotal => bag.fold(0, (sum, line) => sum + line.total);
  Future<void> initialize() async {
    try {
      preferences = await SharedPreferences.getInstance();
      final session = await secure.read(key: 'kapeco_session');
      if (session != null) {
        final data = obj(jsonDecode(session));
        final saved = obj(data['user']);
        if (saved['role'] == 'customer') {
          user = saved;
          api.token = data['token'];
        }
      }
      await loadShopping();
      if (signedIn) {
        try {
          await api.get('/orders/mine');
        } on ApiException catch (e) {
          if (e.status == 401) {
            await logout();
          } else {
            startupError = e.message;
          }
        }
      }
    } catch (_) {
      startupError =
          'Saved session could not be restored. You can sign in again.';
      user = null;
      api.token = null;
    }
    ready = true;
    notifyListeners();
  }

  Future<void> loadShopping() async {
    dynamic read(String key) {
      try {
        return jsonDecode(preferences?.getString(storageKey(key)) ?? 'null');
      } catch (_) {
        return null;
      }
    }

    bag = rows(read('bag')).map(BagLine.fromJson).toList();
    favorites = rows(read('favorites'));
    address = obj(read('address'));
    notifyListeners();
  }

  Future<void> persist() async {
    final prefix = 'kapeco:$scope:';
    await preferences?.setString(
      '${prefix}bag',
      jsonEncode(bag.map((line) => line.toJson()).toList()),
    );
    await preferences?.setString('${prefix}favorites', jsonEncode(favorites));
    await preferences?.setString('${prefix}address', jsonEncode(address));
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    final result = obj(
      await api.post('/auth/login', {
        'email': identifier.trim(),
        'password': password,
      }),
    );
    final account = obj(result['user']);
    if (account['role'] != 'customer') {
      throw ApiException(
        'This app is for customers. Please use the web staff portal for admin or delivery accounts.',
      );
    }
    if (result['token'] == null || account['_id'] == null) {
      throw ApiException('The server returned an incomplete session.');
    }
    final guestBag = scope == 'guest' ? List<BagLine>.from(bag) : <BagLine>[];
    final guestFavorites = scope == 'guest'
        ? List<Json>.from(favorites)
        : <Json>[];
    final guestAddress = scope == 'guest'
        ? Map<String, dynamic>.from(address)
        : <String, dynamic>{};
    await secure.write(key: 'kapeco_session', value: jsonEncode(result));
    user = account;
    api.token = '${result['token']}';
    await loadShopping();
    for (final line in guestBag) {
      final existing = bag.where((saved) => saved.key == line.key);
      if (existing.isEmpty) {
        bag.add(line);
      } else {
        existing.first.quantity += line.quantity;
      }
    }
    for (final item in guestFavorites) {
      if (!favorites.any((p) => p['_id'] == item['_id'])) favorites.add(item);
    }
    if (address.isEmpty && guestBag.isNotEmpty) address = guestAddress;
    await persist();
    for (final key in ['bag', 'favorites', 'address']) {
      await preferences?.remove('kapeco:guest:$key');
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await persist();
    await secure.delete(key: 'kapeco_session');
    user = null;
    api.token = null;
    await loadShopping();
    notifyListeners();
  }

  Future<void> add(BagLine line) async {
    final total =
        bag.where((b) => b.id == line.id).fold(0, (s, b) => s + b.quantity) +
        line.quantity;
    if (total > number(line.product['stock'])) {
      throw ApiException('Your bag exceeds the available stock.');
    }
    final existing = bag.where((b) => b.key == line.key);
    if (existing.isEmpty) {
      bag.add(line);
    } else {
      existing.first.quantity += line.quantity;
    }
    await persist();
  }

  Future<void> setQuantity(BagLine line, int value) async {
    final otherQuantity = bag
        .where((item) => item.id == line.id && item != line)
        .fold(0, (sum, item) => sum + item.quantity);
    if (value > 0 && value + otherQuantity > number(line.product['stock'])) {
      throw ApiException('Your bag exceeds the available stock.');
    }
    if (value <= 0) {
      bag.remove(line);
    } else {
      line.quantity = value;
    }
    await persist();
  }

  Future<void> toggleFavorite(Json product) async {
    if (favorites.any((p) => p['_id'] == product['_id'])) {
      favorites.removeWhere((p) => p['_id'] == product['_id']);
    } else {
      favorites.add(product);
    }
    await persist();
  }

  Future<void> clearPurchasedBag(String fingerprint) async {
    if (jsonEncode(bag.map((l) => l.payload).toList()) == fingerprint) {
      bag = [];
      await persist();
    }
  }

  Future<void> updateProfile(Json profile) async {
    user = obj(
      (await api.request(
        '/auth/profile',
        method: 'PATCH',
        body: profile,
      ))['payload'],
    );
    await secure.write(
      key: 'kapeco_session',
      value: jsonEncode({'token': api.token, 'user': user}),
    );
    notifyListeners();
  }
}
