package com.smartcalendar;

import com.smartcalendar.entity.Task;
import com.smartcalendar.exception.TaskNotFoundException;
import com.smartcalendar.repository.UserRepository;
import com.smartcalendar.service.TaskService;
import com.smartcalendar.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
class AccountIsolationTests {
    @Autowired
    private TaskService taskService;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Test
    void accountsCanOnlyReadAndModifyTheirOwnTasks() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String firstUsername = "test_a_" + suffix;
        String secondUsername = "test_b_" + suffix;
        userService.registerUser(firstUsername, "first-password");
        userService.registerUser(secondUsername, "second-password");

        Task firstTask = taskService.saveTask(newTask("Private task A"), firstUsername);
        taskService.saveTask(newTask("Private task B"), secondUsername);

        assertEquals(1, taskService.getAllTasks(firstUsername).size());
        assertEquals(1, taskService.getAllTasks(secondUsername).size());
        assertEquals(1, taskService.getTotalTasks(firstUsername));
        assertThrows(TaskNotFoundException.class, () -> taskService.getTaskById(firstTask.getId(), secondUsername));
        assertEquals("USER", userRepository.findByUsername(firstUsername).orElseThrow().getRole());
    }

    @Test
    void taskCompletionCanBeToggledBothWays() {
        String username = "toggle_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        userService.registerUser(username, "toggle-password");
        Task task = taskService.saveTask(newTask("Toggle task"), username);

        Task completedTask = taskService.setTaskCompleted(task.getId(), true, username);
        assertEquals(true, completedTask.getCompleted());
        assertEquals("Completed", completedTask.getStatus());

        Task reopenedTask = taskService.setTaskCompleted(task.getId(), false, username);
        assertEquals(false, reopenedTask.getCompleted());
        assertEquals("Pending", reopenedTask.getStatus());
    }

    private Task newTask(String title) {
        Task task = new Task();
        task.setTitle(title);
        task.setDescription(title);
        task.setDate(LocalDate.now().plusDays(1));
        task.setTime(LocalTime.of(9, 0));
        task.setPriority("Medium");
        task.setCategory("Work");
        task.setStatus("Pending");
        task.setReminder(5);
        task.setCompleted(false);
        return task;
    }
}
