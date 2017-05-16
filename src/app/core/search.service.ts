import { Injectable } from '@angular/core';
import { Http, Response, URLSearchParams } from '@angular/http';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/pluck';
import 'rxjs/add/operator/retry';
import 'rxjs/add/operator/scan';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/switchMap';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { Artist } from '../../data-models/artist';
import { SearchResult } from '../../data-models/search-result';
import { SimplifiedAlbum } from '../../data-models/simplified-album';
import { Track } from '../../data-models/track';

@Injectable()
export class SearchService {
  private url = 'https://api.spotify.com/v1/search';
  private queries: Subject<string>;
  private pageRequests: Subject<number>;
  private results: Observable<SearchResult>;
  private isLoading: BehaviorSubject<boolean>;
  private isEnded: BehaviorSubject<boolean>;

  constructor(private http: Http) {
    this.isLoading = new BehaviorSubject(false);
    this.isEnded = new BehaviorSubject(false);
    this.queries = new Subject<string>();
    this.pageRequests = new Subject<number>();

    const pages: Observable<number> = this.pageRequests
      .scan((currentPage: number, nextPage: number) => {
        return Number.isInteger(nextPage) ? nextPage : currentPage + 1;
      }, 0)
      .do(() => this.isEnded.next(true));

    this.results = this.queries
      .combineLatest(pages)
      .debounceTime(300)
      .distinctUntilChanged()
      .do(() => this.isLoading.next(true))
      .switchMap(([query, page]: [string, number]) => query ?
        this.search(query, page) :
        Observable.of(this.emptyResult))
      .do((results: SearchResult) => {
        const isEnded = ['albums', 'artists', 'tracks']
          .every((key: string) => {
            return !results[key] || !results[key].next;
          });
        this.isEnded.next(isEnded);
        this.isLoading.next(false);
      })
      .scan((results, currentResults) => {
        if (results.query === currentResults.query) {
          const items = {};
          ['albums', 'artists', 'tracks'].forEach((key: string) => {
            if (results[key] && currentResults[key]) {
              currentResults[key].items = results[key].items
                .concat(currentResults[key].items);
            }
          });
        }

        return currentResults;
      }, this.emptyResult)
      .share();
  }

  nextQuery(q: string): SearchService {
    this.queries.next(q);
    this.nextPage(0);

    return this;
  }

  nextPage(page?: number): SearchService {
    if (!this.isEnded.getValue() && !this.isLoading.getValue()) {
      this.pageRequests.next(page);
    }

    return this;
  }

  getResults(): Observable<SearchResult> {
    return this.results;
  }

  getLoadingStatus(): Observable<boolean> {
    return this.isLoading.asObservable();
  }

  getEndStatus(): Observable<boolean> {
    return this.isEnded.asObservable();
  }

  getArtists(): Observable<Artist[]> {
    return this.sliceResults('artists');
  }

  getAlbums(): Observable<SimplifiedAlbum[]> {
    return this.sliceResults('albums');
  }

  getTracks(): Observable<Track[]> {
    return this.sliceResults('tracks');
  }

  private get emptyResult(): SearchResult {
    return { query: '' };
  }

  private sliceResults(key: string): Observable<any[]> {
    return this.results.pluck(key, 'items');
  }

  private search(
    q: string,
    page = 0,
    limit = 50,
    types = ['album', 'artist', 'track'],
  ): Observable<SearchResult> {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('offset', String(page * limit));
    params.set('limit', String(limit));
    params.set('type', types.map((t) => t.trim()).join(','));

    return this.http
      .get(this.url, { search: params })
      .retry(5)
      .map((res: Response) => res.json() as SearchResult)
      .map((result) => Object.assign(result, { query: q }))
      .catch((err: any) => Observable.of({ query: q }));
  }
}