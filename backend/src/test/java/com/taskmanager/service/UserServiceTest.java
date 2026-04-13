package com.taskmanager.service;

import com.taskmanager.dto.UserRequest;
import com.taskmanager.entity.Role;
import com.taskmanager.entity.RoleName;
import com.taskmanager.entity.User;
import com.taskmanager.repository.RoleRepository;
import com.taskmanager.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void createUser_encodesPasswordAndAssignsRole() {
        UserRequest request = new UserRequest();
        request.setName("Alice");
        request.setEmail("alice@test.com");
        request.setPassword("raw");
        request.setRoles(Set.of(RoleName.MANAGER));

        Role role = Role.builder().id(1L).roleName(RoleName.MANAGER).build();

        when(passwordEncoder.encode("raw")).thenReturn("encoded");
        when(roleRepository.findByRoleName(RoleName.MANAGER)).thenReturn(Optional.of(role));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(10L);
            return u;
        });

        var response = userService.create(request);

        assertEquals("alice@test.com", response.getEmail());
        assertEquals("MANAGER", response.getRoles().iterator().next());
    }
}
