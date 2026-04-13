package com.taskmanager.controller;

import com.taskmanager.dto.SettingsRequest;
import com.taskmanager.dto.SettingsResponse;
import com.taskmanager.service.SettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {
    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<SettingsResponse> get(Authentication authentication) {
        return ResponseEntity.ok(settingsService.getSettings(authentication));
    }

    @PutMapping
    public ResponseEntity<SettingsResponse> update(Authentication authentication, @RequestBody SettingsRequest request) {
        return ResponseEntity.ok(settingsService.updateSettings(authentication, request));
    }
}
