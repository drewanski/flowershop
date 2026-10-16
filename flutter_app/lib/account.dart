import 'package:flutter/material.dart';

import 'core.dart';
import 'ui.dart';

Future<bool> requireCustomer(BuildContext context, ShopStore store) async {
  if (store.signedIn) return true;
  final result = await Navigator.of(context)
      .push<bool>(MaterialPageRoute(builder: (_) => AuthScreen(store)));
  return result == true && store.signedIn;
}

class AuthScreen extends StatefulWidget {
  final ShopStore store;
  const AuthScreen(this.store, {super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      first = TextEditingController(),
      last = TextEditingController(),
      phone = TextEditingController(),
      confirm = TextEditingController();
  bool registering = false, hidden = true;
  @override
  void dispose() {
    for (final c in [email, password, first, last, phone, confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Widget field(
    TextEditingController c,
    String label, {
    bool obscure = false,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: c,
      obscureText: obscure,
      keyboardType: keyboard,
      autocorrect: !obscure,
      decoration: InputDecoration(labelText: label),
      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(registering ? 'Create your account' : 'Welcome to Sampaguita'),
    ),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Image.asset('assets/sampaguita/logo_a.png', height: 108, fit: BoxFit.contain),
              ),
            ),
            Heading(
              registering ? 'A beautiful beginning.' : 'Welcome back.',
              registering
                  ? 'Create a customer account to order and follow your deliveries.'
                  : 'Sign in to continue to checkout. Your guest bag stays with you.',
            ),
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (registering) ...[
                    field(first, 'First name'),
                    field(last, 'Last name'),
                    field(
                      phone,
                      'Mobile number',
                      keyboard: TextInputType.phone,
                    ),
                  ],
                  field(
                    email,
                    registering ? 'Email' : 'Email, username, or phone',
                  ),
                  TextFormField(
                    controller: password,
                    obscureText: hidden,
                    autocorrect: false,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      suffixIcon: IconButton(
                        tooltip: hidden ? 'Show password' : 'Hide password',
                        onPressed: () => setState(() => hidden = !hidden),
                        icon: Icon(
                          hidden
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    validator: (v) =>
                        v == null || v.length < (registering ? 8 : 1)
                        ? registering
                              ? 'Use at least 8 characters'
                              : 'Enter your password'
                        : null,
                  ),
                  gap(),
                  if (registering)
                    field(confirm, 'Confirm password', obscure: true),
                  ActionButton(registering ? 'Create customer account' : 'Sign in', () async {
                    if (!form.currentState!.validate()) return;
                    if (registering) {
                      if (password.text != confirm.text) {
                        throw ApiException('Passwords do not match.');
                      }
                      await widget.store.api.post('/auth/register-customer', {
                        'firstName': first.text.trim(),
                        'lastName': last.text.trim(),
                        'contactNumber': phone.text.trim(),
                        'email': email.text.trim(),
                        'username':
                            'customer${DateTime.now().microsecondsSinceEpoch}',
                        'password': password.text,
                      });
                    }
                    await widget.store.login(email.text, password.text);
                    if (context.mounted) Navigator.pop(context, true);
                  }),
                  gap(),
                  TextButton(
                    onPressed: () => setState(() => registering = !registering),
                    child: Text(
                      registering
                          ? 'Already have an account? Sign in'
                          : 'New here? Create an account',
                    ),
                  ),
                  if (!registering)
                    TextButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ResetScreen(widget.store),
                        ),
                      ),
                      child: const Text('Forgot password?'),
                    ),
                  const Divider(),
                  const Text(
                    'Customer app only. Staff and riders use the web portal.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class AccountScreen extends StatelessWidget {
  final ShopStore store;
  const AccountScreen(this.store, {super.key});
  @override
  Widget build(BuildContext context) {
    if (!store.signedIn) {
      return EmptyState(
        'Your coffee corner',
        'Sign in to order, save your favorites, and track every delivery.',
        action: ActionButton('Sign in / create account', () async {
          await requireCustomer(context, store);
        }),
      );
    }
    final user = store.user!;
    return PageBody(
      children: [
        Heading(
          'Hello, ${user['firstName']}.',
          'Good coffee. Everyday moments.',
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.person_outline, size: 40, color: sage),
                gap(),
                Text(
                  '${user['firstName']} ${user['lastName']}',
                  style: const TextStyle(fontSize: 22),
                ),
                Text('${user['email']}'),
                Text('${user['contactNumber'] ?? ''}'),
                gap(),
                Text(
                  '${user['bio'] ?? 'Make time for a little coffee ritual.'}',
                ),
                gap(),
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ProfileScreen(store)),
                  ),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit profile'),
                ),
              ],
            ),
          ),
        ),
        gap(),
        Card(
          child: ListTile(
            leading: const Icon(Icons.delivery_dining),
            title: const Text('Saved delivery address'),
            subtitle: Text(
              store.address.isEmpty
                  ? 'Choose an address during checkout.'
                  : addressLabel(store.address),
            ),
          ),
        ),
        gap(),
        ActionButton('Sign out', () async {
          await store.logout();
          if (context.mounted) {
            notice(
              context,
              'Signed out. Your customer bag is saved privately.',
            );
          }
        }),
      ],
    );
  }
}

class ProfileScreen extends StatefulWidget {
  final ShopStore store;
  const ProfileScreen(this.store, {super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final first = TextEditingController(
        text: '${widget.store.user?['firstName'] ?? ''}',
      ),
      last = TextEditingController(
        text: '${widget.store.user?['lastName'] ?? ''}',
      ),
      bio = TextEditingController(text: '${widget.store.user?['bio'] ?? ''}'),
      address = TextEditingController(
        text: '${widget.store.user?['homeAddress'] ?? ''}',
      );
  @override
  void dispose() {
    for (final c in [first, last, bio, address]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Edit profile')),
    body: PageBody(
      children: [
        for (final entry in [
          (first, 'First name'),
          (last, 'Last name'),
          (bio, 'About you'),
          (address, 'Home address'),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: TextField(
              controller: entry.$1,
              decoration: InputDecoration(labelText: entry.$2),
            ),
          ),
        ActionButton('Save profile', () async {
          if (first.text.trim().isEmpty || last.text.trim().isEmpty) {
            throw ApiException('First and last name are required.');
          }
          await widget.store.updateProfile({
            'firstName': first.text.trim(),
            'lastName': last.text.trim(),
            'bio': bio.text.trim(),
            'homeAddress': address.text.trim(),
          });
          if (context.mounted) Navigator.pop(context);
        }),
      ],
    ),
  );
}

class ResetScreen extends StatefulWidget {
  final ShopStore store;
  const ResetScreen(this.store, {super.key});
  @override
  State<ResetScreen> createState() => _ResetScreenState();
}

class _ResetScreenState extends State<ResetScreen> {
  final email = TextEditingController(),
      otp = TextEditingController(),
      password = TextEditingController();
  bool sent = false;
  @override
  void dispose() {
    email.dispose();
    otp.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Reset password')),
    body: PageBody(
      children: [
        const Heading(
          'A fresh start.',
          'Request a reset code, then enter the code from your email.',
        ),
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        gap(),
        ActionButton('Send reset code', () async {
          final data = await widget.store.api.request(
            '/auth/password-reset/request',
            method: 'POST',
            body: {'email': email.text.trim()},
          );
          setState(() => sent = true);
          if (context.mounted) notice(context, data['message']);
        }),
        if (sent) ...[
          gap(),
          TextField(
            controller: otp,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Six-digit code'),
          ),
          gap(),
          TextField(
            controller: password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'New password (8+ characters)',
            ),
          ),
          gap(),
          ActionButton('Reset password', () async {
            await widget.store.api.post('/auth/password-reset/confirm', {
              'email': email.text.trim(),
              'otp': otp.text.trim(),
              'newPassword': password.text,
            });
            if (context.mounted) {
              notice(
                context,
                'Password updated. Sign in with your new password.',
              );
              Navigator.pop(context);
            }
          }),
        ],
      ],
    ),
  );
}

class ContactScreen extends StatefulWidget {
  final ShopStore store;
  const ContactScreen(this.store, {super.key});
  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final name = TextEditingController(),
      email = TextEditingController(),
      message = TextEditingController();
  @override
  void dispose() {
    name.dispose();
    email.dispose();
    message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Contact Kape & Co.')),
    body: PageBody(
      children: [
        const Heading(
          'Let\'s talk coffee.',
          'Questions about ingredients, your order, or a little feedback?',
        ),
        for (final entry in [
          (name, 'Your name'),
          (email, 'Email'),
          (message, 'Message'),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: TextField(
              controller: entry.$1,
              maxLines: entry.$1 == message ? 5 : 1,
              decoration: InputDecoration(labelText: entry.$2),
            ),
          ),
        ActionButton('Send message', () async {
          if (name.text.trim().isEmpty ||
              email.text.trim().isEmpty ||
              message.text.trim().isEmpty) {
            throw ApiException('Fill in all fields.');
          }
          await widget.store.api.post('/contact', {
            'name': name.text.trim(),
            'email': email.text.trim(),
            'message': message.text.trim(),
          });
          if (context.mounted) {
            notice(context, 'Message sent. Thank you.');
            Navigator.pop(context);
          }
        }),
      ],
    ),
  );
}
