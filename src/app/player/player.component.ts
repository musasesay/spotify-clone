import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import 'rxjs/add/operator/pluck';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { Track } from '../../data-models/track';
import { PlayerService } from '../core/player.service';

@Component({
  selector: 'spot-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('audio') audio: ElementRef;

  repeated = false;
  shuffled = false;
  currentTimeMS = 0;
  durationMS = 0;
  volume = 1;
  volumeBeforeMute = 1;
  src: string;
  tracks: Track[];
  currentTrack: Track;
  currentIndex: number;
  private subscription: Subscription;

  constructor(private playerService: PlayerService) {
  }

  ngOnInit() {
    this.subscription = this.playerService
      .getPlaylist()
      .subscribe((tracks: Track[]) => {
        if (!tracks || !tracks.length) {
          return;
        }

        this.tracks = tracks;
        this.currentIndex = 0;
        this.currentTrack = this.tracks[this.currentIndex];
        this.src = this.currentTrack.preview_url;
      });

    this.subscription.add(
      this.playerService
        .getRequest()
        .subscribe((play: boolean) => {
          if (play) {
            this.play();
          } else {
            this.pause();
          }
        }),
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  prev(): void {
    if (!this.tracks || !this.tracks.length) {
      return;
    }

    this.currentIndex = (this.currentIndex - 1 + this.tracks.length) %
      this.tracks.length;
    this.currentTrack = this.tracks[this.currentIndex];
    this.src = this.currentTrack.preview_url;
  }

  next(): void {
    if (!this.tracks || !this.tracks.length) {
      return;
    }

    this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
    this.currentTrack = this.tracks[this.currentIndex];
    this.src = this.currentTrack.preview_url;
  }

  seek(frac: number): void {
    this.audioEl.currentTime = frac * this.audioEl.duration;
    this.play();
  }

  toggleMute(): void {
    if (this.volume > 0) {
      this.volumeBeforeMute = this.volume;
      this.volume = 0;
    } else {
      this.volume = this.volumeBeforeMute;
    }
  }

  onPlaying(): void {
    this.playerService.updateStatus({ paused: false });
  }

  onPause(): void {
    this.playerService.updateStatus({ paused: true });
  }

  onLoadedMetadata(): void {
    this.durationMS = this.audioEl.duration * 1000;
    this.onTimeUpdate();
  }

  onTimeUpdate(): void {
    this.currentTimeMS = this.audioEl.currentTime * 1000;
  }

  private play(): void {
    this.audioEl.play();
  }

  private pause(): void {
    this.audioEl.pause();
  }

  private get audioEl(): HTMLAudioElement {
    return this.audio.nativeElement;
  }
}
