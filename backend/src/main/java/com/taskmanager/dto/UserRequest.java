package com.taskmanager.dto;

import com.taskmanager.entity.RoleName;
import lombok.Data;

import java.util.Set;

@Data
public class UserRequest {
    private String name;
    private String email;
    private String password;
    private Set<RoleName> roles;
}
