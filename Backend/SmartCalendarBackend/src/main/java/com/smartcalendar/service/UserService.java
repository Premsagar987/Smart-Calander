package com.smartcalendar.service;

import com.smartcalendar.entity.User;
import com.smartcalendar.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public User registerUser(String username, String password) {
        if (username == null || !username.matches("[A-Za-z0-9_-]{3,32}")) {
            throw new IllegalArgumentException("Username must be 3–32 characters using letters, numbers, underscores, or hyphens");
        }
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw new IllegalArgumentException("Password must be between 8 and 72 characters");
        }
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }

        return userRepository.save(new User(username, passwordEncoder.encode(password), "USER"));
    }

    public User ensureDefaultUser(String username, String password, String role) {
        return userRepository.findByUsername(username)
                .orElseGet(() -> {
                    User user = new User();
                    user.setUsername(username);
                    user.setPassword(passwordEncoder.encode(password));
                    user.setRole(role);
                    return userRepository.save(user);
                });
    }
}