import Phaser from "phaser";
import "./style.css";
import { preloadCharacters, createCharacterAnims, fighterAnimation } from "./characters";

type FighterState = "idle" | "walk" | "jump" | "attack" | "hurt" | "block" | "ko";
type MoveConfig = { name: string; damage: number; reach: number; windup: number; active: number; recovery: number; knockback: number; color: number };

const MOVES: Record<string, MoveConfig> = {
  light: { name: "JAB", damage: 6, reach: 76, windup: 90, active: 110, recovery: 180, knockback: 90, color: 0xffd166 },
  heavy: { name: "HEAVY", damage: 12, reach: 94, windup: 190, active: 130, recovery: 330, knockback: 190, color: 0xff794f },
  special: { name: "SPECIAL", damage: 18, reach: 148, windup: 280, active: 180, recovery: 480, knockback: 300, color: 0x73d9ff }
};

interface FighterData {
  name: string;
  color: number;
  accent: number;
  maxHealth: number;
  speed: number;
  jumpPower: number;
  preferredRange: number;
}

class Fighter {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  health: number;
  facing = 1;
  state: FighterState = "idle";
  stateUntil = 0;
  grounded = true;
  blocking = false;
  attack?: MoveConfig;
  attackStarted = 0;
  attackHit = false;
  hitFlashUntil = 0;
  data: FighterData;
  gfx: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  scene: FightScene;
  cpu = false;

  constructor(scene: FightScene, x: number, data: FighterData, cpu = false) {
    this.scene = scene;
    this.x = x;
    this.y = scene.floorY;
    this.data = data;
    this.health = data.maxHealth;
    this.cpu = cpu;
    this.gfx = scene.add.graphics();
    const atlasKey = data.name === "IRON MAN" ? "iron_man" : "beta_ray_bill";
    const fallbackKey = data.name === "IRON MAN" ? "iron-man-sprite" : "beta-ray-bill-sprite";
    const textureKey = scene.textures.exists(atlasKey) ? atlasKey : fallbackKey;
    this.sprite = scene.add.sprite(x, this.y, textureKey).setOrigin(0.5, 1).setDepth(5);
    if (textureKey === atlasKey) this.sprite.setScale((data.name === "IRON MAN" ? 168 : 176) / Math.max(1, this.sprite.height));
    else this.sprite.setDisplaySize(data.name === "IRON MAN" ? 112 : 126, 168);
    this.label = scene.add.text(x, this.y - 132, data.name, {
      fontFamily: "Inter, sans-serif", fontSize: "12px", fontStyle: "bold", color: "#ffffff",
      stroke: "#08101e", strokeThickness: 4
    }).setOrigin(0.5);
  }

  get busy(): boolean {
    return this.state === "attack" || this.state === "hurt" || this.state === "ko";
  }

  move(direction: number, delta: number, minX: number, maxX: number): void {
    if (this.busy || this.blocking) return;
    this.vx = direction * this.data.speed;
    this.x = Phaser.Math.Clamp(this.x + this.vx * delta / 1000, minX, maxX);
    if (this.grounded) this.state = direction === 0 ? "idle" : "walk";
  }

  jump(): void {
    if (!this.grounded || this.busy || this.blocking) return;
    this.vy = -this.data.jumpPower;
    this.grounded = false;
    this.state = "jump";
  }

  startAttack(move: MoveConfig, now: number): void {
    if (this.busy || this.blocking || !this.grounded) return;
    this.attack = move;
    this.attackStarted = now;
    this.attackHit = false;
    this.state = "attack";
    this.stateUntil = now + move.windup + move.active + move.recovery;
    this.vx = 0;
  }

  takeHit(move: MoveConfig, attacker: Fighter, now: number): void {
    if (this.state === "ko" || this.health <= 0) return;
    const blocked = this.blocking && this.grounded && this.facing === -attacker.facing;
    const damage = blocked ? Math.max(1, Math.round(move.damage * 0.2)) : move.damage;
    this.health = Math.max(0, this.health - damage);
    this.hitFlashUntil = now + 140;
    this.scene.spawnImpact(this.x - this.facing * 14, this.y - 64, blocked ? 0x8dd8ff : move.color, blocked);
    if (this.health <= 0) {
      this.state = "ko";
      this.vx = 0;
      this.vy = 0;
    } else if (!blocked) {
      this.state = "hurt";
      this.stateUntil = now + 250;
      this.vx = attacker.facing * move.knockback;
    } else {
      this.state = "block";
      this.stateUntil = now + 160;
    }
  }

  update(delta: number, now: number): void {
    if (!this.grounded) {
      this.vy += 1050 * delta / 1000;
      this.y += this.vy * delta / 1000;
      if (this.y >= this.scene.floorY) {
        this.y = this.scene.floorY;
        this.vy = 0;
        this.grounded = true;
        if (this.state === "jump") this.state = "idle";
      }
    }
    if (this.state === "hurt") {
      this.x += this.vx * delta / 1000;
      this.vx *= Math.pow(0.001, delta / 1000);
    }
    this.x = Phaser.Math.Clamp(this.x, 55, this.scene.scale.width - 55);
    if (this.state === "attack" && this.attack) {
      const elapsed = now - this.attackStarted;
      if (!this.attackHit && elapsed >= this.attack.windup && elapsed <= this.attack.windup + this.attack.active) {
        this.scene.resolveAttack(this, this.attack);
      }
      if (now >= this.stateUntil) {
        this.state = "idle";
        this.attack = undefined;
      }
    } else if ((this.state === "hurt" || this.state === "block") && now >= this.stateUntil) {
      this.state = "idle";
    }
    if (this.state === "ko") this.vx = 0;
    this.draw(now);
  }

  draw(now: number): void {
    const g = this.gfx;
    g.clear();
    const facing = this.facing;
    const bob = this.state === "idle" ? Math.sin(now / 230 + (this.cpu ? 1 : 0)) * 2 : 0;
    const crouch = this.blocking ? 7 : 0;
    const y = this.y + bob + crouch;
    const x = this.x;
    const hurt = now < this.hitFlashUntil;
    // Original character artwork is the visible fighter. Apply state-based motion.
    const elapsed = now - this.attackStarted;
    const attacking = this.state === "attack" && !!this.attack;
    const attackActive = attacking && elapsed >= this.attack!.windup;
    const walkBob = this.state === "walk" ? Math.sin(now / 65) * 5 : 0;
    const idleBob = this.state === "idle" ? Math.sin(now / 230 + (this.cpu ? 1 : 0)) * 2 : 0;
    const blockDip = this.blocking || this.state === "block" ? 11 : 0;
    const lunge = attackActive ? facing * (this.attack!.name === "SPECIAL" ? 17 : 9) : 0;
    const atlasKey = this.data.name === "IRON MAN" ? "iron_man" : "beta_ray_bill";
    const isAtlas = this.sprite.texture.key === atlasKey;
    if (isAtlas) {
      const animKey = fighterAnimation(atlasKey, this.state);
      if (this.scene.anims.exists(animKey) && this.sprite.anims.currentAnim?.key !== animKey) this.sprite.play(animKey, true);
    }
    const baseScale = isAtlas ? (this.data.name === "IRON MAN" ? 168 : 176) / Math.max(1, this.sprite.height) : (this.data.name === "IRON MAN" ? 0.56 : 0.61);
    this.sprite.setPosition(x + lunge, y - walkBob - idleBob - (this.state === "jump" ? 7 : 0) + blockDip)
      .setFlipX(facing < 0).setAlpha(hurt ? 0.58 : this.state === "ko" ? 0.72 : 1)
      .setRotation(this.state === "ko" ? facing * 1.15 : this.state === "hurt" ? -facing * 0.12 : attacking ? facing * (attackActive ? 0.08 : -0.035) : this.state === "walk" ? Math.sin(now / 65) * 0.035 : 0)
      .setScale(baseScale * (attackActive ? 1.05 : 1), baseScale * (this.state === "block" || this.blocking ? 0.92 : this.state === "jump" ? 1.04 : 1))
      .setDepth(5);
    // Ground shadow and state effects.
    g.fillStyle(0x030611, 0.38); g.fillEllipse(x, this.scene.floorY + 3, 82, 17);
    if (this.blocking) { g.lineStyle(3, 0x8dd8ff, 0.85); g.strokeCircle(x + facing * 28, y - 73, 24); }
    if (this.state === "ko") { g.lineStyle(3, 0xff5d72, 0.9); g.strokeCircle(x, y - 64, 45); }
    this.label.setPosition(x, this.y - 137);
    this.label.setAlpha(this.state === "ko" ? 0.45 : 1);
    return;
    const ironMan = this.data.name === "IRON MAN";
    const betaRayBill = this.data.name === "BETA RAY BILL";
    // Legs
    g.fillStyle(ironMan ? 0x8e2026 : betaRayBill ? 0x183c32 : 0x10182b, 1);
    g.fillRoundedRect(x-16, y-40, 13, 36, 5);
    g.fillRoundedRect(x+3, y-40, 13, 36, 5);
    g.fillStyle(ironMan ? 0xffcf63 : accent, 1);
    g.fillRoundedRect(x-18, y-9, 19, 9, 3);
    g.fillRoundedRect(x+1, y-9, 19, 9, 3);
    // Torso and arms
    g.fillStyle(ironMan ? 0xc92f35 : betaRayBill ? 0x16795c : main, 1); g.fillRoundedRect(x-21, y-91, 42, 53, 10);
    if (ironMan) { g.fillStyle(0xffd36a, 1); g.fillRoundedRect(x-20, y-86, 40, 7, 3); g.fillStyle(0x9eeeff, 1); g.fillCircle(x, y-67, 8); g.fillStyle(0xffffff, 0.9); g.fillCircle(x, y-67, 4); }
    else if (betaRayBill) { g.fillStyle(0x9a253a, 1); g.fillRoundedRect(x-22, y-58, 44, 9, 3); g.fillStyle(0xd9e5ed, 1); g.fillTriangle(x-15, y-100, x-23, y-111, x-7, y-98); g.fillTriangle(x+15, y-100, x+23, y-111, x+7, y-98); g.fillStyle(0x3ab7df, 1); g.fillRoundedRect(x-18, y-87, 36, 7, 3); }
    else { g.fillStyle(accent, 1); g.fillRoundedRect(x-17, y-84, 34, 5, 2); }
    g.fillStyle(main, 1);
    if (this.state === "attack" && this.attack && now - this.attackStarted >= this.attack!.windup) {
      const reach = this.attack!.reach;
      g.fillRoundedRect(facing > 0 ? x+10 : x-reach, y-79, reach-10, 17, 7);
      g.fillStyle(this.attack!.color, 1);
      g.fillCircle(x + facing * (reach-7), y-70, this.attack!.name === "SPECIAL" ? 13 : 8);
      if (this.attack!.name === "SPECIAL") {
        g.lineStyle(3, this.attack!.color, 0.85); g.strokeCircle(x + facing * (reach-7), y-70, 21 + Math.sin(now/20)*3);
      }
    } else {
      const armY = this.blocking ? y-82 : y-73;
      g.fillRoundedRect(x-28, armY, 15, this.blocking ? 34 : 28, 7);
      g.fillRoundedRect(x+13, armY, 15, this.blocking ? 34 : 28, 7);
      g.fillStyle(accent, 1);
      g.fillCircle(x-20, armY+26, 8); g.fillCircle(x+20, armY+26, 8);
    }
    // Character-specific helmet and facial silhouette.
    if (ironMan) {
      g.fillStyle(0xc52b32, 1); g.fillRoundedRect(x-16, y-120, 32, 34, 9);
      g.fillStyle(0xffcf63, 1); g.fillRoundedRect(x-11, y-116, 22, 25, 5);
      g.fillStyle(0xc52b32, 1); g.fillTriangle(x-10, y-93, x+10, y-93, x, y-86);
      g.fillStyle(0x9defff, 1); g.fillTriangle(x+facing*2, y-108, x+facing*12, y-105, x+facing*3, y-102);
    } else if (betaRayBill) {
      g.fillStyle(0x16805d, 1); g.fillRoundedRect(x-16, y-120, 32, 34, 10);
      g.fillStyle(0x0b453c, 1); g.fillTriangle(x-10, y-119, x-3, y-134, x+1, y-118); g.fillTriangle(x+2, y-118, x+11, y-134, x+12, y-117);
      g.fillStyle(0xf4f1e8, 1); g.fillTriangle(x+facing*2, y-108, x+facing*12, y-106, x+facing*3, y-103);
    } else {
      g.fillStyle(0xc99476, 1); g.fillCircle(x, y-103, 17); g.fillStyle(accent, 1); g.fillRoundedRect(x-17, y-111, 34, 11, 5); g.fillStyle(0xf6f8ff, 1); g.fillTriangle(x+facing*3, y-108, x+facing*13, y-106, x+facing*4, y-103);
    }
    if (this.blocking) {
      g.lineStyle(3, 0x8dd8ff, 0.85); g.strokeCircle(x+facing*28, y-73, 24);
    }
    if (this.state === "ko") {
      g.lineStyle(3, 0xff5d72, 0.9); g.strokeCircle(x, y-64, 45);
    }
    this.label.setPosition(x, this.y - 137);
    this.label.setAlpha(this.state === "ko" ? 0.45 : 1);
  }

  destroy(): void {
    this.gfx.destroy();
    this.label.destroy();
  }
}

class FightScene extends Phaser.Scene {
  player!: Fighter;
  cpu!: Fighter;
  floorY = 0;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  arena!: Phaser.GameObjects.Graphics;
  hud!: Phaser.GameObjects.Graphics;
  message!: Phaser.GameObjects.Text;
  help!: Phaser.GameObjects.Text;
  roundOver = false;
  aiNextAction = 0;
  sparks: Array<{ x:number; y:number; color:number; life:number; maxLife:number; block:boolean }> = [];
  padPrevious: boolean[] = [];
  constructor() { super("FightScene"); }

  preload(): void {
    this.load.svg("iron-man-sprite", "assets/iron-man.svg", { width: 220, height: 300 });
    this.load.svg("beta-ray-bill-sprite", "assets/beta-ray-bill.svg", { width: 240, height: 310 });
    preloadCharacters(this);
  }

  create(): void {
    createCharacterAnims(this);
    this.floorY = this.scale.height * 0.79;
    this.arena = this.add.graphics();
    this.hud = this.add.graphics().setDepth(20);
    this.message = this.add.text(this.scale.width/2, this.scale.height*0.27, "", {
      fontFamily:"Barlow Condensed, sans-serif", fontSize:"42px", fontStyle:"bold", color:"#ffffff",
      stroke:"#09101e", strokeThickness:7, align:"center"
    }).setOrigin(0.5).setDepth(30);
    this.help = this.add.text(this.scale.width/2, this.scale.height-17, "A / D MOVER     W PULAR     J LEVE     K PESADO     L ESPECIAL     S DEFENDER     R REINICIAR", {
      fontFamily:"Inter, sans-serif", fontSize:"10px", color:"#b8c6df", letterSpacing:1
    }).setOrigin(0.5,1).setDepth(25);
    this.keys = this.input.keyboard!.addKeys("A,D,W,S,J,K,L,R") as Record<string, Phaser.Input.Keyboard.Key>;
    this.startFight();
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.floorY = size.height * 0.79;
      this.help.setPosition(size.width/2, size.height-17);
      this.message.setPosition(size.width/2, size.height*0.27);
    });
  }

  startFight(): void {
    this.player?.destroy(); this.cpu?.destroy();
    this.roundOver = false; this.sparks = [];
    this.message.setText("");
    this.player = new Fighter(this, this.scale.width*0.29, {
      name:"IRON MAN", color:0xc92f35, accent:0xffcf63, maxHealth:100, speed:300, jumpPower:510, preferredRange:82
    });
    this.cpu = new Fighter(this, this.scale.width*0.71, {
      name:"BETA RAY BILL", color:0x075b8c, accent:0xa52635, maxHealth:100, speed:245, jumpPower:500, preferredRange:88
    }, true);
    this.player.facing = 1; this.cpu.facing = -1;
    this.aiNextAction = this.time.now + 650;
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    this.drawArena(now);
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) { this.startFight(); return; }
    if (this.roundOver) { this.drawHud(); this.updateSparks(delta); return; }
    this.player.facing = this.player.x <= this.cpu.x ? 1 : -1;
    this.cpu.facing = -this.player.facing;

    const pad = this.input.gamepad?.getPad(0);
    const axisX = pad?.axes.length ? pad.axes[0].getValue() : 0;
    const padLeft = !!pad?.buttons[14]?.pressed || axisX < -0.35;
    const padRight = !!pad?.buttons[15]?.pressed || axisX > 0.35;
    const direction = (this.keys.A.isDown || padLeft ? -1 : 0) + (this.keys.D.isDown || padRight ? 1 : 0);
    this.player.blocking = (this.keys.S.isDown || !!pad?.buttons[4]?.pressed || !!pad?.buttons[5]?.pressed) && this.player.grounded && !this.player.busy;
    const pressed = (index: number): boolean => !!pad?.buttons[index]?.pressed;
    const justPressed = (index: number): boolean => pressed(index) && !this.padPrevious[index];
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.W) || justPressed(0) || justPressed(12);
    const lightPressed = Phaser.Input.Keyboard.JustDown(this.keys.J) || justPressed(2);
    const heavyPressed = Phaser.Input.Keyboard.JustDown(this.keys.K) || justPressed(3);
    const specialPressed = Phaser.Input.Keyboard.JustDown(this.keys.L) || justPressed(1);
    const restartPressed = Phaser.Input.Keyboard.JustDown(this.keys.R) || justPressed(9);
    this.padPrevious = Array.from({length: Math.max(16, pad?.buttons.length ?? 0)}, (_, i) => pressed(i));
    if (jumpPressed) this.player.jump();
    if (lightPressed) this.player.startAttack(MOVES.light, now);
    if (heavyPressed) this.player.startAttack(MOVES.heavy, now);
    if (specialPressed) this.player.startAttack(MOVES.special, now);
    if (restartPressed) { this.startFight(); return; }
    this.player.move(direction, delta, 45, this.scale.width-45);

    this.updateAI(now, delta);
    this.separateFighters();
    this.player.update(delta, now); this.cpu.update(delta, now);
    this.updateSparks(delta);
    if (this.player.health <= 0 || this.cpu.health <= 0) {
      this.roundOver = true;
      const winner = this.player.health > 0 ? "VITÓRIA!" : "DERROTA";
      this.message.setText(winner + "\n\nR PARA JOGAR NOVAMENTE");
      this.message.setColor(this.player.health > 0 ? "#ffd166" : "#ff7185");
    }
    this.drawHud();
  }

  updateAI(now: number, delta: number): void {
    const distance = Math.abs(this.player.x - this.cpu.x);
    this.cpu.blocking = false;
    if (this.cpu.busy) { this.cpu.move(0, delta, 45, this.scale.width-45); return; }
    if (now >= this.aiNextAction) {
      this.aiNextAction = now + Phaser.Math.Between(500, 1050);
      if (distance < 120 && Math.random() < 0.23 && this.player.state === "attack") {
        this.cpu.blocking = true; this.cpu.state = "block"; this.cpu.stateUntil = now + 300; return;
      }
      if (distance < 105) {
        const roll = Math.random();
        this.cpu.startAttack(roll > 0.83 ? MOVES.special : roll > 0.45 ? MOVES.heavy : MOVES.light, now);
        return;
      }
      if (distance < 180 && Math.random() < 0.13) this.cpu.jump();
    }
    const dir = distance > this.cpu.data.preferredRange ? Math.sign(this.player.x - this.cpu.x) : 0;
    this.cpu.move(dir, delta, 45, this.scale.width-45);
  }

  separateFighters(): void {
    const overlap = 47 - Math.abs(this.player.x - this.cpu.x);
    if (overlap > 0 && this.player.grounded && this.cpu.grounded) {
      const sign = Math.sign(this.player.x - this.cpu.x) || -1;
      if (!this.player.busy) this.player.x += sign * overlap * 0.5;
      if (!this.cpu.busy) this.cpu.x -= sign * overlap * 0.5;
    }
  }

  resolveAttack(attacker: Fighter, move: MoveConfig): void {
    const target = attacker === this.player ? this.cpu : this.player;
    const distance = Math.abs(target.x - attacker.x);
    const inFront = Math.sign(target.x - attacker.x) === attacker.facing;
    if (distance <= move.reach + 22 && inFront && Math.abs(target.y - attacker.y) < 75) {
      attacker.attackHit = true;
      target.takeHit(move, attacker, this.time.now);
    }
  }

  spawnImpact(x: number, y: number, color: number, block: boolean): void {
    for (let i=0; i<(block?7:13); i++) {
      this.sparks.push({x,y,color,life:Phaser.Math.Between(180,360),maxLife:360,block});
    }
    this.cameras.main.shake(block ? 45 : 90, block ? 0.001 : 0.0022);
  }

  updateSparks(delta: number): void {
    const g = this.add.graphics().setDepth(18);
    this.sparks = this.sparks.filter(s => s.life > 0);
    for (const s of this.sparks) {
      s.life -= delta;
      const p = 1 - s.life / s.maxLife;
      const a = Math.max(0, 1-p);
      const angle = (s.life*0.08) + s.x;
      const r = (s.block?8:15)*p;
      g.fillStyle(s.color, a);
      g.fillCircle(s.x+Math.cos(angle)*r, s.y+Math.sin(angle)*r, Math.max(1,4*(1-p)));
    }
    this.time.delayedCall(0, () => g.destroy());
  }

  drawArena(now: number): void {
    const w=this.scale.width,h=this.scale.height, g=this.arena;
    g.clear();
    g.fillGradientStyle(0x101b31,0x101b31,0x263958,0x111a2a,1); g.fillRect(0,0,w,h);
    // Distant skyline
    g.fillStyle(0x111a2c,0.95);
    for(let i=0;i<18;i++){
      const bw=30+(i%4)*12, bx=i*w/18;
      const bh=70+((i*37)%105);
      g.fillRect(bx,h*0.54-bh,bw,bh);
      for(let yy=h*0.54-bh+10;yy<h*0.54-8;yy+=15) for(let xx=bx+7;xx<bx+bw-4;xx+=12) {
        g.fillStyle((i+Math.floor(xx+yy))%3===0?0x40506b:0x24334c,0.55);g.fillRect(xx,yy,4,5);
      }
      g.fillStyle(0x111a2c,0.95);
    }
    g.fillStyle(0x344b6b,0.25);g.fillRect(0,h*0.53,w,h*0.26);
    g.fillStyle(0x111827,1);g.fillRect(0,this.floorY,w,h-this.floorY);
    g.lineStyle(2,0x6680a7,0.55);g.lineBetween(0,this.floorY,w,this.floorY);
    // Perspective floor
    g.lineStyle(1,0x35455f,0.55);
    for(let i=-8;i<=8;i++) g.lineBetween(w/2+i*18,this.floorY,w/2+i*95,h);
    for(let i=0;i<5;i++){const yy=this.floorY+Math.pow(i/5,1.6)*(h-this.floorY);g.lineBetween(0,yy,w,yy);}
    // Neon arena accents
    g.fillStyle(0x4ad7ff,0.08+Math.sin(now/380)*0.025);g.fillRect(0,this.floorY-3,w,3);
    g.fillStyle(0x080d17,0.75);g.fillRect(0,0,w,12);
  }

  drawHud(): void {
    const g=this.hud,w=this.scale.width;
    g.clear();
    const barW=Math.min(w*0.36,340), barY=28, barH=17;
    const drawBar=(x:number,health:number,color:number,flip:boolean):void=>{
      g.fillStyle(0x050914,0.9);g.fillRoundedRect(x-3,barY-3,barW+6,barH+6,4);
      g.fillStyle(0x27334b,1);g.fillRect(x,barY,barW,barH);
      const filled=barW*health/100;
      g.fillStyle(color,1);g.fillRect(flip?x+barW-filled:x,barY,filled,barH);
      g.lineStyle(1,0xffffff,0.35);g.strokeRect(x,barY,barW,barH);
    };
    drawBar(22,this.player.health,0x42c9f5,false);
    drawBar(w-22-barW,this.cpu.health,0xff536e,true);
    g.fillStyle(0x0a1020,0.9);g.fillRoundedRect(w/2-35,20,70,42,7);
    g.lineStyle(2,0xffbd59,0.8);g.strokeRoundedRect(w/2-35,20,70,42,7);
    // Draw a simple timer that is fixed to the current round presentation.
    this.add.text(w/2,41,"99", {fontFamily:"Barlow Condensed, sans-serif",fontSize:"25px",fontStyle:"bold",color:"#ffffff"}).setOrigin(0.5).setDepth(22).setName("timer-label");
    // Remove last frame's timer label, keeping HUD object count stable.
    const labels=this.children.list.filter(o=>o.name==="timer-label");
    while(labels.length>1) { labels.shift()?.destroy(); }
    const p=this.add.text(25,barY+25,"IRON MAN", {fontFamily:"Inter,sans-serif",fontSize:"10px",fontStyle:"bold",color:"#bdeeff"}).setDepth(21).setName("player-label");
    const c=this.add.text(w-25,barY+25,"BETA RAY BILL", {fontFamily:"Inter,sans-serif",fontSize:"10px",fontStyle:"bold",color:"#ffc0cb"}).setOrigin(1,0).setDepth(21).setName("cpu-label");
    const oldLabels=this.children.list.filter(o=>o.name==="player-label"||o.name==="cpu-label");
    while(oldLabels.length>2) oldLabels.shift()?.destroy();
    p.setPosition(25,barY+25);c.setPosition(w-25,barY+25);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 480,
  backgroundColor: "#101a2d",
  antialias: true,
  render: { pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 480 },
  input: { keyboard: true, gamepad: true, mouse: true, touch: true },
  scene: [FightScene]
});

window.addEventListener("beforeunload", () => game.destroy(true));