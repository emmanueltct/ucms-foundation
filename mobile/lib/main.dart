// lib/main.dart

import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';

void main() {
  runApp(const UcmsApp());
}

class UcmsApp extends StatelessWidget {
  const UcmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = AuthService(
      baseUrl: 'http://localhost:3000/api/v1',
      tenantSlug: 'demo-church', // in production, set from the app's onboarding/workspace picker
    );

    return MaterialApp(
      title: 'UCMS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, fontFamily: 'Inter'),
      home: LoginScreen(
        authService: authService,
        onLoggedIn: () {
          // Foundation module stops here — the post-login home screen is
          // built once the Member/Ministry modules exist to populate it.
        },
      ),
    );
  }
}
