package com.taskmanager.service;

import com.taskmanager.dto.SettingsRequest;
import com.taskmanager.dto.SettingsResponse;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SettingsService {
    private final Map<String, SettingsResponse> settingsStore = new ConcurrentHashMap<>();

    public SettingsResponse getSettings(Authentication authentication) {
        return settingsStore.computeIfAbsent(authentication.getName(),
                key -> SettingsResponse.builder().emailAlerts(true).weeklyDigest(true).build());
    }

    public SettingsResponse updateSettings(Authentication authentication, SettingsRequest request) {
        SettingsResponse updated = SettingsResponse.builder()
                .emailAlerts(request.isEmailAlerts())
                .weeklyDigest(request.isWeeklyDigest())
                .build();
        settingsStore.put(authentication.getName(), updated);
        return updated;
    }
}
