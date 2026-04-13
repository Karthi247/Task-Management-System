package com.taskmanager.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String name;
    private String email;
    private String avatarUrl;
    private Set<String> roles;
}
