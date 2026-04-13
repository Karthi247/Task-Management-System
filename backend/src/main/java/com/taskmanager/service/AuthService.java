package com.taskmanager.service;

import com.taskmanager.dto.*;
import com.taskmanager.entity.*;
import com.taskmanager.repository.RoleRepository;
import com.taskmanager.repository.UserRepository;
import com.taskmanager.util.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse register(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use");
        }
        Set<RoleName> roleNames = request.getRoles() == null || request.getRoles().isEmpty()
                ? Set.of(RoleName.MEMBER) : request.getRoles();

        Set<Role> roles = roleNames.stream()
                .map(rn -> roleRepository.findByRoleName(rn)
                        .orElseGet(() -> roleRepository.save(Role.builder().roleName(rn).build())))
                .collect(Collectors.toSet());

        com.taskmanager.entity.User user = com.taskmanager.entity.User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(roles)
                .build();

        userRepository.save(user);
        User securityUser = new User(user.getEmail(), user.getPassword(),
                roles.stream().map(r -> new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + r.getRoleName())).toList());
        return new AuthResponse(jwtUtil.generateToken(securityUser), user.getEmail(),
                roles.stream().map(r -> r.getRoleName().name()).collect(Collectors.toSet()));
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        User principal = (User) authentication.getPrincipal();
        return new AuthResponse(jwtUtil.generateToken(principal), principal.getUsername(),
                principal.getAuthorities().stream().map(a -> a.getAuthority().replace("ROLE_", "")).collect(Collectors.toSet()));
    }
}
