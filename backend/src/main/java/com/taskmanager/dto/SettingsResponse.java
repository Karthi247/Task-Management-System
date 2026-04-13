package com.taskmanager.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SettingsResponse {
    private boolean emailAlerts;
    private boolean weeklyDigest;
}
