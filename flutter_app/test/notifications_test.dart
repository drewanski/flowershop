import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kape_co/core.dart';
import 'package:kape_co/notifications.dart';

void main() {
  final notice = <String, dynamic>{
    '_id': '01',
    'order': 'order',
    'title': 'Preparing',
    'readAt': null,
  };
  test('saved inbox refreshes unread count and alerts only for newly arriving records', () async {
    var items = [notice];
    final store = ShopStore(
      api: Api(
        client: MockClient(
          (_) async => http.Response(
            jsonEncode({
              'payload': {
                'items': items,
                'unreadCount': items.length,
                'nextCursor': null,
              },
            }),
            200,
          ),
        ),
      ),
    )..user = {'_id': 'customer', 'role': 'customer'};
    store.api.token = 'customer-token';
    final feed = NotificationFeed(store);
    expect(await feed.refresh(), isNull);
    expect(feed.unread, 1);
    items = [
      {...notice, '_id': '02'},
      notice,
    ];
    expect((await feed.refresh())?['_id'], '02');
    expect(await feed.refresh(), isNull);
    feed.dispose();
  });
  test(
    'logout during an inbox request discards its private response',
    () async {
      late ShopStore isolatedStore;
      final api = Api(
        client: MockClient((_) async {
          isolatedStore.user = null;
          isolatedStore.api.token = null;
          return http.Response(
            jsonEncode({
              'payload': {
                'items': [notice],
                'unreadCount': 1,
              },
            }),
            200,
          );
        }),
      );
      isolatedStore = ShopStore(api: api)
        ..user = {'_id': 'customer', 'role': 'customer'};
      api.token = 'token';
      final feed = NotificationFeed(isolatedStore);
      await feed.refresh();
      expect(feed.items, isEmpty);
      feed.dispose();
    },
  );
  test('mark-all sends the latest displayed boundary to the server', () async {
    final requests = <http.Request>[];
    final store = ShopStore(
      api: Api(
        client: MockClient((request) async {
          requests.add(request);
          return http.Response(
            '{"payload":{"items":[],"unreadCount":0,"nextCursor":null}}',
            200,
          );
        }),
      ),
    )..user = {'_id': 'customer', 'role': 'customer'};
    store.api.token = 'token';
    final feed = NotificationFeed(store)..items = [notice];
    await feed.readAll();
    expect(requests.first.method, 'PATCH');
    expect(jsonDecode(requests.first.body), {'through': '01'});
    feed.dispose();
  });
}
