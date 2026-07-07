// lib/services/auth_service.dart
//
// Talks to the Foundation module's /auth endpoints. Tokens are kept only in
// memory here; a real app should use flutter_secure_storage for the refresh
// token so it survives app restarts without living in plain SharedPreferences.

import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  AuthTokens({required this.accessToken, required this.refreshToken, required this.expiresIn});

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: json['expiresIn'] as int,
      );
}

class AuthUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final List<String> roles;
  final List<String> permissions;

  AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.roles,
    required this.permissions,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        roles: List<String>.from(json['roles'] as List),
        permissions: List<String>.from(json['permissions'] as List),
      );
}

class ApiException implements Exception {
  final String code;
  final String message;
  ApiException(this.code, this.message);

  @override
  String toString() => 'ApiException($code): $message';
}

class AuthService {
  final String baseUrl; // e.g. https://api.ucms.app/api/v1
  final String tenantSlug;

  AuthTokens? _tokens;
  AuthUser? _currentUser;

  AuthService({required this.baseUrl, required this.tenantSlug});

  AuthUser? get currentUser => _currentUser;
  bool get isAuthenticated => _tokens != null;

  Map<String, String> get _baseHeaders => {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': tenantSlug,
      };

  Future<AuthUser> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _baseHeaders,
      body: jsonEncode({'email': email, 'password': password}),
    );

    final body = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode != 200 || body['success'] != true) {
      final error = body['error'] as Map<String, dynamic>?;
      throw ApiException(error?['code'] ?? 'UNKNOWN_ERROR', error?['message'] ?? 'Login failed.');
    }

    final data = body['data'] as Map<String, dynamic>;
    _tokens = AuthTokens.fromJson(data['tokens'] as Map<String, dynamic>);
    _currentUser = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    return _currentUser!;
  }

  Future<void> refreshSession() async {
    if (_tokens == null) throw ApiException('NO_SESSION', 'Not logged in.');

    final res = await http.post(
      Uri.parse('$baseUrl/auth/refresh'),
      headers: _baseHeaders,
      body: jsonEncode({'refreshToken': _tokens!.refreshToken}),
    );

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200 || body['success'] != true) {
      _tokens = null;
      _currentUser = null;
      final error = body['error'] as Map<String, dynamic>?;
      throw ApiException(error?['code'] ?? 'REFRESH_FAILED', error?['message'] ?? 'Session expired.');
    }

    final data = body['data'] as Map<String, dynamic>;
    _tokens = AuthTokens.fromJson(data['tokens'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    if (_tokens == null) return;
    await http.post(
      Uri.parse('$baseUrl/auth/logout'),
      headers: {..._baseHeaders, 'Authorization': 'Bearer ${_tokens!.accessToken}'},
      body: jsonEncode({'refreshToken': _tokens!.refreshToken}),
    );
    _tokens = null;
    _currentUser = null;
  }

  /// Attach this to any authenticated request made elsewhere in the app.
  Map<String, String> authHeaders() {
    if (_tokens == null) throw ApiException('NO_SESSION', 'Not logged in.');
    return {..._baseHeaders, 'Authorization': 'Bearer ${_tokens!.accessToken}'};
  }
}
