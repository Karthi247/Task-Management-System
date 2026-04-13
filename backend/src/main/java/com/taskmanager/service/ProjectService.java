package com.taskmanager.service;

import com.taskmanager.dto.ProjectRequest;
import com.taskmanager.dto.ProjectResponse;
import com.taskmanager.entity.Project;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.repository.ProjectRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ProjectService {
    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    public Project getEntity(Long id) {
        return projectRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    public List<ProjectResponse> findAll(String q) {
        if (q != null && !q.isBlank()) {
            return projectRepository
                    .findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(q, q)
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }
        return projectRepository.findAll().stream().map(this::toResponse).toList();
    }

    public ProjectResponse create(ProjectRequest request) {
        Project p = Project.builder()
                .name(requireName(request.getName()))
                .description(normalizeText(request.getDescription()))
                .createdDate(LocalDate.now())
                .build();
        return toResponse(projectRepository.save(p));
    }

    public ProjectResponse update(Long id, ProjectRequest request) {
        Project p = getEntity(id);
        if (request.getName() != null) {
            p.setName(requireName(request.getName()));
        }
        if (request.getDescription() != null) {
            p.setDescription(normalizeText(request.getDescription()));
        }
        return toResponse(projectRepository.save(p));
    }

    public void delete(Long id) {
        if (!projectRepository.existsById(id)) throw new ResourceNotFoundException("Project not found");
        projectRepository.deleteById(id);
    }

    private ProjectResponse toResponse(Project p) {
        return ProjectResponse.builder().id(p.getId()).name(p.getName()).description(p.getDescription()).createdDate(p.getCreatedDate()).build();
    }

    private String requireName(String name) {
        String value = normalizeText(name);
        if (value == null) {
            throw new IllegalArgumentException("Project name is required");
        }
        return value;
    }

    private String normalizeText(String value) {
        return value == null ? null : value.trim();
    }
}
