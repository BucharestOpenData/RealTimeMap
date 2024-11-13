import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers || [],  // Spread existing providers if any
    provideHttpClient(),           // Ensure HttpClient is provided
  ]
}).catch((err) => console.error(err));
