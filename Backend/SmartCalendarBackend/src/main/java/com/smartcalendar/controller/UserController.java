package com.smartcalendar.controller;

import com.smartcalendar.dto.RegisterRequest;
import com.smartcalendar.entity.User;
import com.smartcalendar.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> registerUser(@Valid @RequestBody RegisterRequest request) {
        User savedUser = userService.registerUser(request.username(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("username", savedUser.getUsername()));
    }

    @GetMapping("/me")
    public Map<String, String> currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
        }

        return Map.of("username", authentication.getName());
    }
}