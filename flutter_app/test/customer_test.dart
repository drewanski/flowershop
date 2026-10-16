import 'package:flutter/material.dart';

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kape_co/core.dart';
import 'package:kape_co/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final product = <String, dynamic>{
    '_id': 'coffee',
    'name': 'Latte',
    'price': 150,
    'stock': 20,
    'optionGroups': [
      {
        'name': 'Size',
        'choices': [
          {'label': 'Large', 'priceAdjustment': 30},
        ],
      },
    ],
  };
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });
  test('configured bag calculates and serializes backend selections', () {
    final line = BagLine(
      product,
      [
        {'name': 'Size', 'value': 'Large'},
      ],
      [
        {'_id': 'milk', 'name': 'Oat milk', 'price': 35, 'quantity': 2},
      ],
      quantity: 2,
    );
    expect(line.unitPrice, 250);
    expect(line.total, 500);
    expect(line.payload['addons'], [
      {'addon': 'milk', 'quantity': 2},
    ]);
    expect(BagLine.fromJson(line.toJson()).key, line.key);
  });
  test(
    'guest bag merges once; logout and another customer never expose it',
    () async {
      final api = Api(
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              'payload': {
                'user': {
                  '_id': jsonDecode(request.body)['email'],
                  'role': 'customer',
                },
                'token': 'test-token',
              },
            }),
            200,
          ),
        ),
      );
      final store = ShopStore(api: api);
      await store.initialize();
      await store.add(BagLine(product, [], []));
      await store.login('alice', 'password');
      expect(store.count, 1);
      await store.logout();
      expect(store.count, 0);
      await store.login('bob', 'password');
      expect(store.count, 0);
      await store.logout();
      await store.login('alice', 'password');
      expect(store.count, 1);
    },
  );
  test(
    'staff login is rejected and does not establish a customer session',
    () async {
      final store = ShopStore(
        api: Api(
          client: MockClient(
            (_) async => http.Response(
              jsonEncode({
                'payload': {
                  'user': {'_id': 'admin', 'role': 'admin'},
                  'token': 'staff-token',
                },
              }),
              200,
            ),
          ),
        ),
      );
      await store.initialize();
      await expectLater(
        store.login('admin', 'password'),
        throwsA(isA<ApiException>()),
      );
      expect(store.signedIn, false);
      expect(store.api.token, isNull);
    },
  );
  test('payment completion only clears the exact purchased bag', () async {
    final store = ShopStore();
    await store.initialize();
    await store.add(BagLine(product, [], []));
    final snapshot = jsonEncode(store.bag.map((l) => l.payload).toList());
    await store.add(BagLine(product, [], []));
    await store.clearPurchasedBag(snapshot);
    expect(store.count, 2);
    await store.clearPurchasedBag(
      jsonEncode(store.bag.map((l) => l.payload).toList()),
    );
    expect(store.count, 0);
  });
  test('API forwards authentication and preserves server rejection', () async {
    final api = Api(
      client: MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer customer-token');
        return http.Response(jsonEncode({'message': 'Stock unavailable'}), 409);
      }),
    )..token = 'customer-token';
    await expectLater(
      api.post('/orders', {}),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 409)
            .having((e) => e.message, 'message', 'Stock unavailable'),
      ),
    );
  });
  testWidgets('customer shell renders menu and sign-in-gated empty orders', (
    tester,
  ) async {
    final store = ShopStore(
      api: Api(
        client: MockClient((_) async => http.Response('{"payload":[]}', 200)),
      ),
    );
    await store.initialize();
    await tester.pumpWidget(KapeApp(store: store));
    await tester.pumpAndSettle();
    expect(find.text('Sampaguita'), findsOneWidget);
    await tester.tap(find.text('Orders'));
    await tester.pumpAndSettle();
    expect(find.text('Follow your next cup.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
