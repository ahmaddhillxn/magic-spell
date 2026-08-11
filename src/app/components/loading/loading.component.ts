import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceLoaderService } from '../services/resource-loader';


@Component({
  selector: 'app-loading',
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.css',
})
export class LoadingComponent {
  constructor(public loader: ResourceLoaderService) {}
}
