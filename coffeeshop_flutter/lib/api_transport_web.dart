import 'dart:html' as html;

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
  try {
    final response = await html.HttpRequest.request(
      uri.toString(),
      method: method,
      requestHeaders: headers,
      sendData: body,
      responseType: 'text',
    );
    return ApiTransportResponse(
      response.status ?? 200,
      response.responseText ?? '',
    );
  } on html.ProgressEvent {
    throw Exception(
      'Cannot reach the coffee shop server. Check the backend, API_BASE_URL, and browser CORS settings.',
    );
  }
}
