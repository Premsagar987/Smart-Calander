package com.smartcalendar.controller;

import com.smartcalendar.entity.Task;
import com.smartcalendar.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tasks")
public class TaskController {
    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<Task> createTask(
            @Valid @RequestBody Task task,
            @AuthenticationPrincipal UserDetails user) {
        Task savedTask = taskService.saveTask(task, user.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(savedTask);
    }

    @GetMapping
    public List<Task> getAllTasks(@AuthenticationPrincipal UserDetails user) {
        return taskService.getAllTasks(user.getUsername());
    }

    @GetMapping("/page")
    public Page<Task> getTasksWithPagination(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.getTasksWithPagination(page, size, user.getUsername());
    }

    @GetMapping("/search")
    public List<Task> searchTasksByTitle(
            @RequestParam String title,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.searchTaskByTitle(title, user.getUsername());
    }

    @GetMapping("/category")
    public List<Task> getTasksByCategory(
            @RequestParam String category,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.getTasksByCategory(category, user.getUsername());
    }

    @GetMapping("/status")
    public List<Task> getTasksByStatus(
            @RequestParam String status,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.getTasksByStatus(status, user.getUsername());
    }

    @GetMapping("/sort/date")
    public List<Task> getTasksSortedByDate(@AuthenticationPrincipal UserDetails user) {
        return taskService.getTasksSortedByDate(user.getUsername());
    }

    @GetMapping("/{id}")
    public Task getTaskById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.getTaskById(id, user.getUsername());
    }

    @GetMapping("/stats")
    public Map<String, Long> getTaskStatistics(@AuthenticationPrincipal UserDetails user) {
        String username = user.getUsername();
        Map<String, Long> stats = new HashMap<>();
        stats.put("totalTasks", taskService.getTotalTasks(username));
        stats.put("completedTasks", taskService.getCompletedTasks(username));
        stats.put("pendingTasks", taskService.getPendingTasks(username));
        return stats;
    }

    @PutMapping("/{id}")
    public Task updateTask(
            @PathVariable Long id,
            @Valid @RequestBody Task task,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.updateTask(id, task, user.getUsername());
    }

    @GetMapping("/sort/priority")
    public List<Task> getTasksSortedByPriority(@AuthenticationPrincipal UserDetails user) {
        return taskService.getTasksSortedByPriority(user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        taskService.deleteTask(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/complete")
    public Task markTaskCompleted(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.markTaskCompleted(id, user.getUsername());
    }

    @PatchMapping("/{id}/completion")
    public Task setTaskCompleted(
            @PathVariable Long id,
            @RequestParam boolean completed,
            @AuthenticationPrincipal UserDetails user) {
        return taskService.setTaskCompleted(id, completed, user.getUsername());
    }
}
