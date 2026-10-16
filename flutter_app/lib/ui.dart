import 'package:flutter/material.dart';

import 'core.dart';

const espresso = Color(0xff553725),
    sage = Color(0xff43513d),
    cream = Color(0xfff7f2e9),
    ink = Color(0xff34271f);
ThemeData coffeeTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: 'Poppins',
  scaffoldBackgroundColor: cream,
  colorScheme: ColorScheme.fromSeed(
    seedColor: espresso,
    primary: espresso,
    secondary: sage,
    surface: const Color(0xfffffcf6),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: cream,
    foregroundColor: ink,
    centerTitle: false,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: const Color(0xfffffcf6),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xffded3c4)),
    ),
    contentPadding: const EdgeInsets.all(16),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 17),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    color: const Color(0xfffffcf6),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: Color(0xffe6dccd)),
    ),
  ),
);
void notice(BuildContext context, Object message) {
  if (context.mounted) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$message')));
  }
}

Future<void> attempt(
  BuildContext context,
  Future<void> Function() action,
) async {
  try {
    await action();
  } catch (e) {
    if (context.mounted) notice(context, e);
  }
}

class CoffeeImage extends StatelessWidget {
  final Json product;
  final double? height;
  final BoxFit fit;
  const CoffeeImage(
    this.product, {
    super.key,
    this.height,
    this.fit = BoxFit.cover,
  });
  @override
  Widget build(BuildContext context) {
    final path = '${product['image'] ?? product['img'] ?? ''}';
    final fallback = SizedBox(
      height: height,
      child: const Center(
        child: Icon(Icons.local_cafe_outlined, size: 48, color: espresso),
      ),
    );
    final file = path.split('/').last;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: path.startsWith('/images/products/')
          ? Image.asset(
              'assets/images/$file',
              height: height,
              width: double.infinity,
              fit: fit,
              errorBuilder: (_, e, s) => fallback,
            )
          : Uri.tryParse(path)?.hasScheme == true
          ? Image.network(
              path,
              height: height,
              width: double.infinity,
              fit: fit,
              errorBuilder: (_, e, s) => fallback,
            )
          : fallback,
    );
  }
}

class PageBody extends StatelessWidget {
  final List<Widget> children;
  const PageBody({super.key, required this.children});
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 1100),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 16, 22, 36),
        children: children,
      ),
    ),
  );
}

class Heading extends StatelessWidget {
  final String title, subtitle;
  const Heading(this.title, this.subtitle, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'KAPE & CO.',
          style: TextStyle(
            letterSpacing: 3,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Theme.of(context).colorScheme.secondary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Gilda',
            fontSize: 36,
            height: 1.15,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          subtitle,
          style: const TextStyle(
            color: Color(0xff827365),
            fontSize: 13,
            height: 1.7,
          ),
        ),
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  final String title, message;
  final Widget? action;
  const EmptyState(this.title, this.message, {super.key, this.action});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
    child: Column(
      children: [
        const Icon(Icons.coffee_outlined, color: sage, size: 44),
        const SizedBox(height: 18),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontFamily: 'Gilda', fontSize: 26),
        ),
        const SizedBox(height: 10),
        Text(message, textAlign: TextAlign.center),
        if (action != null)
          Padding(padding: const EdgeInsets.only(top: 20), child: action!),
      ],
    ),
  );
}

class RemoteData extends StatefulWidget {
  final Future<dynamic> Function() load;
  final Widget Function(dynamic) builder;
  const RemoteData({super.key, required this.load, required this.builder});
  @override
  State<RemoteData> createState() => _RemoteDataState();
}

class _RemoteDataState extends State<RemoteData> {
  late Future<dynamic> data;
  @override
  void initState() {
    super.initState();
    data = widget.load();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: data,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: CircularProgressIndicator(),
          ),
        );
      }
      if (snapshot.hasError) {
        return EmptyState(
          'A little longer than usual',
          '${snapshot.error}',
          action: FilledButton(
            onPressed: () => setState(() => data = widget.load()),
            child: const Text('Try again'),
          ),
        );
      }
      return widget.builder(snapshot.data);
    },
  );
}

class ActionButton extends StatefulWidget {
  final String label;
  final Future<void> Function() action;
  final IconData? icon;
  const ActionButton(this.label, this.action, {super.key, this.icon});
  @override
  State<ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<ActionButton> {
  bool busy = false;
  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: busy
        ? null
        : () async {
            setState(() => busy = true);
            try {
              await widget.action();
            } catch (e) {
              if (context.mounted) notice(context, e);
            } finally {
              if (mounted) setState(() => busy = false);
            }
          },
    child: Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        else if (widget.icon != null)
          Icon(widget.icon, size: 18),
        if (busy || widget.icon != null) const SizedBox(width: 10),
        Text(busy ? 'Please wait...' : widget.label),
      ],
    ),
  );
}

class StatusBadge extends StatelessWidget {
  final String text;
  const StatusBadge(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: sage.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        color: sage,
        fontWeight: FontWeight.w500,
      ),
    ),
  );
}

Widget gap([double height = 16]) => SizedBox(height: height);
