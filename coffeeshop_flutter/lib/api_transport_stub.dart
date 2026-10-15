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
) {
  throw UnsupportedError('HTTP transport is not supported on this platform.');
}
