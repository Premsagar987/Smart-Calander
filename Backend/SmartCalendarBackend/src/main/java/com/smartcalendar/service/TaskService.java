package com.smartcalendar.service;

import com.smartcalendar.entity.Task;
import com.smartcalendar.entity.User;
import com.smartcalendar.exception.TaskNotFoundException;
import com.smartcalendar.repository.TaskRepository;
import com.smartcalendar.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    public Task saveTask(Task task, String username) {
        task.setOwner(getUser(username));
        return taskRepository.save(task);
    }

    public List<Task> getAllTasks(String username) {
        return taskRepository.findAllByOwner_Username(username);
    }

    public Page<Task> getTasksWithPagination(int page, int size, String username) {
        Pageable pageable = PageRequest.of(page, size);
        return taskRepository.findAllByOwner_Username(username, pageable);
    }

    public List<Task> searchTaskByTitle(String title, String username) {
        return taskRepository.findByOwner_UsernameAndTitleContainingIgnoreCase(username, title);
    }

    public List<Task> getTasksByCategory(String category, String username) {
        return taskRepository.findByOwner_UsernameAndCategoryIgnoreCase(username, category);
    }

    public List<Task> getTasksByStatus(String status, String username) {
        return taskRepository.findByOwner_UsernameAndStatusIgnoreCase(username, status);
    }

    public List<Task> getTasksSortedByDate(String username) {
        return taskRepository.findAllByOwner_UsernameOrderByDateAsc(username);
    }

    public long getTotalTasks(String username) {
        return taskRepository.countByOwner_Username(username);
    }

    public long getCompletedTasks(String username) {
        return taskRepository.countByOwner_UsernameAndCompleted(username, true);
    }

    public long getPendingTasks(String username) {
        return taskRepository.countByOwner_UsernameAndCompleted(username, false);
    }

    public Task markTaskCompleted(Long id, String username) {
        return setTaskCompleted(id, true, username);
    }

    public Task setTaskCompleted(Long id, boolean completed, String username) {
        Task task = getTask(id, username);
        task.setCompleted(completed);
        task.setStatus(completed ? "Completed" : "Pending");
        return taskRepository.save(task);
    }

    public List<Task> getTasksSortedByPriority(String username) {
        return taskRepository.findAllByOwner_UsernameOrderByPriorityAsc(username);
    }

    public Task getTaskById(Long id, String username) {
        return getTask(id, username);
    }

    public void deleteTask(Long id, String username) {
        taskRepository.delete(getTask(id, username));
    }

    public Task updateTask(Long id, Task updatedTask, String username) {
        Task existingTask = getTask(id, username);
        existingTask.setTitle(updatedTask.getTitle());
        existingTask.setDescription(updatedTask.getDescription());
        existingTask.setDate(updatedTask.getDate());
        existingTask.setTime(updatedTask.getTime());
        existingTask.setPriority(updatedTask.getPriority());
        existingTask.setCategory(updatedTask.getCategory());
        existingTask.setStatus(updatedTask.getStatus());
        existingTask.setReminder(updatedTask.getReminder());
        existingTask.setCompleted(updatedTask.getCompleted());
        return taskRepository.save(existingTask);
    }

    @Transactional
    public int assignLegacyTasksToDefaultUser(String username) {
        return taskRepository.assignUnownedTasksToUser(getUser(username));
    }

    private Task getTask(Long id, String username) {
        return taskRepository.findByIdAndOwner_Username(id, username)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with id: " + id));
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user no longer exists"));
    }
}
