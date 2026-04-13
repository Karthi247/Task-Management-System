package com.taskmanager.dto;

import lombok.Data;

@Data
public class SettingsRequest {
    private boolean emailAlerts;
    private boolean weeklyDigest;
}
