import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-docs',
  template: '',
  standalone: true,
  // No template needed, because we are redirecting
})
export class DocsComponent implements OnInit {

  ngOnInit(): void {
    // Redirect to the static HTML file located in assets/docs/index.html
    window.location.href = 'assets/docs/index.html';
  }
}
