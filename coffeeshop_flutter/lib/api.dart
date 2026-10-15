import 'dart:convert';

import 'api_transport_stub.dart'
    if (dart.library.io) 'api_transport_io.dart'
    if (dart.library.html) 'api_transport_web.dart' as transport;

/// Change this for your environment. Android emulator: http://10.0.2.2:5000/api
/// iOS simulator: http://localhost:5000/api. Physical devices need your computer's LAN IP.
class CoffeeApi {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5000/api',
  );
  static String? token;

  static Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
    };
    final response = await transport.send(
      method,
      Uri.parse('$baseUrl$path'),
      headers,
      body == null ? null : jsonEncode(body),
    );

    dynamic decoded;
    try {
      decoded = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
    } catch (_) {
      decoded = {'message': response.body};
    }

    final data = decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{'payload': decoded};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data['message']?.toString() ??
            'Request failed (${response.statusCode})',
      );
    }
    return data;
  }
}
