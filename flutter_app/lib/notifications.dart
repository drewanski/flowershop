import 'dart:async';

import 'package:flutter/material.dart';

import 'core.dart';
import 'ui.dart';
import 'orders.dart';

class NotificationFeed extends ChangeNotifier {
  final ShopStore store;
  final String owner;
  List<Json> items = [];
  int unread = 0;
  String error = '';
  String? nextCursor, latest;
  bool busy = false, disposed = false;
  NotificationFeed(this.store) : owner = store.scope;
  bool get current => !disposed && store.signedIn && owner == store.scope;
  Future<Json?> refresh({bool older = false}) async {
    if (busy || !current || (older && nextCursor == null)) return null;
    busy = true;
    Json? alert;
    try {
      final page = obj(
        await store.api.get(
          '/notifications${older ? '?before=${Uri.encodeComponent(nextCursor!)}' : ''}',
        ),
      );
      if (!current) return null;
      final values = rows(page['items']);
      if (!older) {
        final newest = values.isEmpty ? null : values.first;
        if (latest != null &&
            newest != null &&
            '${newest['_id']}'.compareTo(latest!) > 0 &&
            newest['readAt'] == null) {
          alert = newest;
        }
        latest = newest == null ? (latest ?? '0') : '${newest['_id']}';
        items = values;
      } else {
        items = [
          ...items,
          ...values.where((v) => !items.any((item) => item['_id'] == v['_id'])),
        ];
      }
      unread = number(page['unreadCount']).toInt();
      nextCursor = page['nextCursor'];
      error = '';
    } catch (e) {
      if (current) error = '$e';
    } finally {
      busy = false;
      if (current) notifyListeners();
    }
    return alert;
  }

  Future<void> read(Json item) async {
    if (!current) return;
    await store.api.request(
      '/notifications/${item['_id']}/read',
      method: 'PATCH',
      body: {},
    );
    await refresh();
  }

  Future<void> readAll() async {
    if (!current || items.isEmpty) return;
    await store.api.request(
      '/notifications/read-all',
      method: 'PATCH',
      body: {'through': items.first['_id']},
    );
    await refresh();
  }

  @override
  void dispose() {
    disposed = true;
    super.dispose();
  }
}

class NotificationsBell extends StatefulWidget {
  final ShopStore store;
  const NotificationsBell(this.store, {super.key});
  @override
  State<NotificationsBell> createState() => _NotificationsBellState();
}

class _NotificationsBellState extends State<NotificationsBell>
    with WidgetsBindingObserver {
  late final NotificationFeed feed;
  Timer? timer;
  bool foreground = true, sheetOpen = false;
  @override
  void initState() {
    super.initState();
    feed = NotificationFeed(widget.store);
    WidgetsBinding.instance.addObserver(this);
    check();
    timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (foreground) check();
    });
  }

  Future<void> check() async {
    final alert = await feed.refresh();
    if (!mounted || alert == null || sheetOpen) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${alert['title']}: ${alert['message']}'),
        action: SnackBarAction(
          label: 'View',
          onPressed: () => openOrder(alert),
        ),
      ),
    );
  }

  Future<void> openOrder(Json item) async {
    await attempt(context, () async {
      await feed.read(item);
      if (!mounted || !feed.current) return;
      if (sheetOpen) Navigator.pop(context);
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OrderDetailScreen(widget.store, '${item['order']}'),
        ),
      );
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (foreground) check();
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    feed.dispose();
    super.dispose();
  }

  Future<void> showInbox() async {
    sheetOpen = true;
    unawaited(feed.refresh());
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      constraints: const BoxConstraints(maxWidth: 600),
      builder: (context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .8,
          child: AnimatedBuilder(
            animation: feed,
            builder: (context, _) => Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Your notifications',
                          style: TextStyle(fontFamily: 'Gilda', fontSize: 25),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close notifications',
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${feed.unread} unread · Updates every 10s',
                          style: const TextStyle(fontSize: 11),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Refresh notifications',
                        onPressed: feed.busy ? null : () => feed.refresh(),
                        icon: const Icon(Icons.refresh),
                      ),
                      TextButton(
                        onPressed: feed.unread == 0
                            ? null
                            : () => attempt(context, feed.readAll),
                        child: const Text('Mark all read'),
                      ),
                    ],
                  ),
                ),
                if (feed.error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text(
                      feed.error,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                const Divider(),
                Expanded(
                  child: feed.items.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(
                              feed.busy ? 'Loading notifications…' : "You're all caught up. Order updates will appear here.",
                            ),
                          ),
                        )
                      : ListView(
                          children: [
                            for (final item in feed.items)
                              Container(
                                color: item['readAt'] == null
                                    ? sage.withValues(alpha: .08)
                                    : null,
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 10,
                                  ),
                                  leading: Icon(
                                    item['readAt'] == null
                                        ? Icons.notifications_active_outlined
                                        : Icons.notifications_none,
                                    color: sage,
                                  ),
                                  title: Text(
                                    '${item['title']}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${item['message']}\n${dateLabel(item['createdAt'])}\nView order →',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      height: 1.8,
                                    ),
                                  ),
                                  onTap: () => openOrder(item),
                                  trailing: item['readAt'] == null
                                      ? IconButton(
                                          tooltip: 'Mark notification read',
                                          onPressed: () => attempt(
                                            context,
                                            () => feed.read(item),
                                          ),
                                          icon: const Icon(
                                            Icons.done,
                                            size: 19,
                                          ),
                                        )
                                      : null,
                                ),
                              ),
                            if (feed.nextCursor != null)
                              TextButton(
                                onPressed: feed.busy
                                    ? null
                                    : () => feed.refresh(older: true),
                                child: const Text('Load older notifications'),
                              ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    sheetOpen = false;
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: feed,
    builder: (context, _) => IconButton(
      tooltip: 'Notifications, ${feed.unread} unread',
      onPressed: showInbox,
      icon: Badge(
        isLabelVisible: feed.unread > 0,
        label: Text(feed.unread > 99 ? '99+' : '${feed.unread}'),
        child: const Icon(Icons.notifications_none),
      ),
    ),
  );
}
