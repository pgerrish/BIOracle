/* Account-scoped, revision-checked autosave. Kept separate for race-condition tests. */
(function (root) {
  'use strict';
  class DraftSync {
    constructor({load, save, read, write, changed, delay = 700}) {
      Object.assign(this, {load, save, read, write, changed, delay});
      this.userId = null; this.epoch = 0; this.revision = 0;
      this.dirty = false; this.loaded = false; this.conflict = null;
      this.timer = null; this.inflight = null; this.loading = null;
    }
    report(status, detail = {}) { this.changed({status, dirty:this.dirty, userId:this.userId, ...detail}); }
    cancel() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
    async setUser(userId) {
      if (this.userId === userId) { if (!userId) this.report('signed-out'); return; }
      const previous = this.userId;
      this.cancel(); this.epoch++; this.userId = userId;
      this.revision = 0; this.loaded = false; this.conflict = null; this.inflight = null;
      if (previous) { this.write({}); this.dirty = false; }
      if (!userId) { this.report('signed-out'); return; }
      return this.restore();
    }
    restore() {
      const epoch = this.epoch, userId = this.userId;
      this.report('loading');
      const loading = (async () => {
        try {
          const row = await this.load(userId);
          if (epoch !== this.epoch) return;
          this.loaded = true;
          this.revision = row?.revision || 0;
          if (row && this.dirty && JSON.stringify(this.read()) !== JSON.stringify(row.answers)) {
            this.conflict = row; this.report('conflict'); return;
          }
          if (row) { this.write(row.answers); this.dirty = false; this.report('saved', {updatedAt:row.updated_at}); }
          else if (this.dirty) this.queue();
          else this.report('ready');
        } catch {
          if (epoch !== this.epoch) return;
          this.loaded = false; this.report('load-error');
        }
      })();
      this.loading = loading;
      return loading;
    }
    edit() {
      this.dirty = true;
      if (!this.userId) { this.report('signed-out'); return; }
      if (this.conflict) { this.report('conflict'); return; }
      if (!this.loaded) return;
      this.queue();
    }
    queue() {
      this.cancel(); this.report('pending');
      this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.delay);
    }
    async flush() {
      this.cancel();
      if (!this.userId) return !this.dirty;
      if (this.loading) await this.loading;
      if (!this.loaded || this.conflict) return false;
      if (this.inflight) return this.inflight;
      const epoch = this.epoch, userId = this.userId;
      const task = (async () => {
        while (this.dirty && epoch === this.epoch) {
          const answers = structuredClone(this.read());
          this.report('saving');
          try {
            const row = await this.save(userId, answers, this.revision);
            if (epoch !== this.epoch) return false;
            this.revision = row.revision;
            this.dirty = JSON.stringify(this.read()) !== JSON.stringify(answers);
            if (!this.dirty) this.report('saved', {updatedAt:row.updated_at});
          } catch (error) {
            if (epoch !== this.epoch) return false;
            if (error.code === '40001') {
              try {
                const row = await this.load(userId);
                if (epoch !== this.epoch) return false;
                if (!row) throw new Error('Draft disappeared');
                this.conflict = row; this.report('conflict');
              } catch { this.loaded = false; this.report('load-error'); }
            } else this.report('save-error');
            return false;
          }
        }
        return epoch === this.epoch && !this.dirty;
      })();
      this.inflight = task;
      try { return await task; }
      finally { if (this.inflight === task) this.inflight = null; }
    }
    async retry() {
      if (!this.userId) return false;
      if (!this.loaded) await this.restore();
      return this.flush();
    }
    useSaved() {
      if (!this.conflict) return;
      this.cancel(); this.write(this.conflict.answers); this.revision = this.conflict.revision;
      const updatedAt = this.conflict.updated_at;
      this.conflict = null; this.dirty = false; this.loaded = true;
      this.report('saved', {updatedAt});
    }
    keepLocal() {
      if (!this.conflict) return;
      this.revision = this.conflict.revision; this.conflict = null;
      this.loaded = true; this.dirty = true; this.queue();
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = DraftSync;
  else root.BIOracleDraftSync = DraftSync;
})(typeof globalThis !== 'undefined' ? globalThis : this);
