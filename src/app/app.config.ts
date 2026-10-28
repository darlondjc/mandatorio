import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { DataSource } from './core/data-source';
import { firebaseConfig } from './core/firebase-config';
import { FirestoreDataSource } from './core/firestore-data-source';
import { SampleDataSource } from './core/sample-data-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    {
      provide: DataSource,
      useFactory: () => (firebaseConfig ? new FirestoreDataSource(firebaseConfig) : new SampleDataSource()),
    },
  ],
};
