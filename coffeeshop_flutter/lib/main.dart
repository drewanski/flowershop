import 'package:flutter/material.dart';
import 'screens.dart';

void main() => runApp(const CoffeeShopApp());

class CoffeeShopApp extends StatelessWidget {
  const CoffeeShopApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Brew & Bean',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF6F432B),
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: const Color(0xFFFAF6F0),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFFFAF6F0),
        foregroundColor: Color(0xFF38251B),
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
      ),
    ),
    home: const ShopShell(),
  );
}
