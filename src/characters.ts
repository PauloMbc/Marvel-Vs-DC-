import Phaser from "phaser";

/** Loads the real character atlases. Relative paths work on GitHub Pages project sites. */
export function preloadCharacters(scene: Phaser.Scene): void {
  scene.load.atlas("iron_man", "assets/characters/iron_man.png", "assets/characters/iron_man.json");
  scene.load.atlas("beta_ray_bill", "assets/characters/beta_ray_bill (1).png", "assets/characters/beta_ray_bill.json");
}

function frames(texture: string, ids: number[]): Phaser.Types.Animations.AnimationFrame[] {
  return ids.map((id) => ({ key: texture, frame: `${texture}_${String(id).padStart(2, "0")}` }));
}

export function createCharacterAnims(scene: Phaser.Scene): void {
  const define = (key: string, texture: string, ids: number[], frameRate: number, repeat = -1) => {
    if (scene.anims.exists(key) || !scene.textures.exists(texture)) return;
    const valid = ids.filter((id) => scene.textures.get(texture).has(`${texture}_${String(id).padStart(2, "0")}`));
    if (valid.length) scene.anims.create({ key, frames: frames(texture, valid), frameRate, repeat });
  };
  define("iron_man_idle", "iron_man", [1, 9, 3, 8], 4);
  define("iron_man_walk", "iron_man", [10, 11, 8, 9], 7);
  define("iron_man_jump", "iron_man", [2, 4], 6, 0);
  define("iron_man_attack", "iron_man", [10, 5, 13], 10, 0);
  define("iron_man_fly", "iron_man", [4, 12, 5, 6, 13], 8);
  define("iron_man_beam", "iron_man", [14, 25], 10, 0);
  define("iron_man_hit_fx", "iron_man", [16, 17, 18, 19, 20, 21], 16, 0);
  define("iron_man_lightning", "iron_man", [23, 24], 12);
  define("beta_ray_bill_idle", "beta_ray_bill", [28, 29, 30, 29], 4);
  define("beta_ray_bill_walk", "beta_ray_bill", [23, 24, 30, 16], 7);
  define("beta_ray_bill_jump", "beta_ray_bill", [20, 21, 13], 7, 0);
  define("beta_ray_bill_attack", "beta_ray_bill", [12, 2, 18], 9, 0);
  define("beta_ray_bill_fly", "beta_ray_bill", [22, 14], 7);
}

export function fighterAnimation(character: "iron_man" | "beta_ray_bill", state: string): string {
  const suffix = state === "walk" ? "walk" : state === "jump" ? "jump" : state === "attack" ? "attack" : "idle";
  return `${character}_${suffix}`;
}
