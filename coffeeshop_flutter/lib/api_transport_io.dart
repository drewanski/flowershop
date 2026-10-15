import 'dart:convert';
import 'dart:io';

class ApiTransportResponse {
  final int statusCode;
  final String body;

  const ApiTransportResponse(this.statusCode, this.body);
}

Future<ApiTransportResponse> send(
  String method,
  Uri uri,
  Map<String, String> headers,
  String? body,
) async {
  final client = HttpClient();
  try {
    final request = await client.openUrl(method, uri);
    headers.forEach(request.headers.set);
    if (body != null) request.write(body);
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    return ApiTransportResponse(response.statusCode, responseBody);
  } on SocketException {
    throw Exception(
      'Cannot reach the coffee shop server. Check the backend and API_BASE_URL.',
    );
  } finally {
    client.close(force: true);
  }
}
