import { ApplicationConfig, inject, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { DataSource } from './core/data-source';
import { appCheckSiteKey } from './core/app-check-config';
import { Carregamento, comCarregamento } from './core/carregamento';
import { firebaseConfig } from './core/firebase-config';
import { FirestoreDataSource } from './core/firestore-data-source';
import { SampleDataSource } from './core/sample-data-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    {
      provide: DataSource,
      useFactory: () =>
        comCarregamento(firebaseConfig ? new FirestoreDataSource(firebaseConfig, appCheckSiteKey) : new SampleDataSource(), inject(Carregamento)),
    },
    // Os dados (Firestore) não passam pelo service worker: o SDK já mantém seu próprio cache.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
