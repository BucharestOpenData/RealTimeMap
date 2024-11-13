import { Component, EventEmitter, Inject, Output, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../auth.service';
import { isPlatformBrowser, NgIf } from "@angular/common";

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf
  ],
  styleUrls: ['./toolbar.component.css']
})
export class ToolbarComponent {
  @Output() userIdEvent = new EventEmitter<string>();

  loginForm: FormGroup;
  isMobile: boolean;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isMobile = this.detectMobile();
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  private detectMobile(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    }
    return false;
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { username, password } = this.loginForm.value;
      this.authService.login(username, password).subscribe(
        response => {
          if (response.success) {
            this.snackBar.open('Login successful!', 'Close', {
              duration: 3000
            });
            this.userIdEvent.emit(response.userId);
          } else {
            this.snackBar.open('Login failed: ' + response.message, 'Close', {
              duration: 3000
            });
          }
        },
        error => {
          let errorMessage = 'Login failed!';
          if (error.error && error.error.message) {
            errorMessage = `Login failed: ${error.error.message}`;
          }
          this.snackBar.open(errorMessage, 'Close', {
            duration: 3000
          });
          console.error(error);
        }
      );
    }
  }
}
