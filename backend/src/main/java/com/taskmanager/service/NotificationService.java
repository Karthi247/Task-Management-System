package com.taskmanager.service;

import com.taskmanager.dto.NotificationResponse;
import com.taskmanager.entity.Task;
import com.taskmanager.entity.User;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.repository.TaskRepository;
import com.taskmanager.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class NotificationService {
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public NotificationService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    public List<NotificationResponse> getNotifications(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        List<Task> tasks = taskRepository.findTop5ByAssignedToOrderByDueDateAsc(user);
        List<NotificationResponse> notes = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Task task : tasks) {
            String type = "INFO";
            String message = "Task is scheduled.";
            if (task.getDueDate() != null) {
                if (task.getDueDate().isBefore(today)) {
                    type = "OVERDUE";
                    message = "Task is overdue.";
                } else if (!task.getDueDate().isAfter(today.plusDays(3))) {
                    type = "DUE_SOON";
                    message = "Task due soon.";
                }
            }
            notes.add(NotificationResponse.builder()
                    .id(task.getId())
                    .title(task.getTitle())
                    .message(message)
                    .type(type)
                    .build());
        }
        return notes;
    }
}
