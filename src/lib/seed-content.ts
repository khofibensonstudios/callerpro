import type { PostKind } from "./types";

export const SAMPLE_VIDEO = "/videos/a.mp4";
export const SAMPLE_CLIP = "/videos/b.mp4";
export const SAMPLE_VIDEO_2 = "/videos/c.mp4";

export const JOLLOF_ARTICLE = `Guests text that they are ten minutes away. You have rice, tomatoes, an onion, and no interest in performing a three-hour ceremony. This is the weeknight jollof-style pot I actually cook.

Start with heat, not with a shopping list. Warm a wide pot until a drop of water skates. Film the bottom with oil. Slice one large onion and let it go past polite and into sweet. If it threatens to burn, add a spoon of water and keep stirring. Color is flavor. Pale onions make pale rice.

Blend or grate three ripe tomatoes with a red pepper if you have one. Pour that into the onions and stay with the pot. You are driving off water until the mix looks like jam, not soup. This is the step people skip, and it is why restaurant jollof tastes like a place and home jollof tastes like regret. When the spoon leaves a trail, add tomato paste, a pinch of curry, thyme, a bay leaf, salt, and a little smoked paprika if that is what you have. Cook the paste for two full minutes so it loses the tin taste.

Wash long-grain rice until the water runs closer to clear. Stir the raw rice through the jam so every grain gets coated. Pour in hot stock or hot water just to the first knuckle above the rice. Tight lid. Medium-low. Do not keep lifting the lid to check on it like it owes you rent.

At minute ten, listen. If it hisses angrily, it is dry. Splash a little more hot water around the edge, not into the middle. At minute twelve, turn the heat off and let it steam. The bottom should be a little toasted. That crust is not a mistake. Fluff with a fork, not a masher.

What I put on the table: sliced cucumber, a fried egg if protein is thin, and whatever leftover chicken is in the fridge. People remember that you fed them, not that you plated a magazine.

Common failures: using cold water (the rice panics and goes gluey), crowding a tiny pot (steam cannot move), and salting only at the end (the grain never tastes seasoned). Salt the jam. Taste the jam. Then add rice.

If you cook this twice, you will stop measuring. That is the point of Connect Pro for me: I am not a television chef. I am the person who still has to eat on a Tuesday. Follow the method, then argue with it. The pot will tell you when it is ready.`;

export const GUITAR_ARTICLE = `You do not need a new guitar. You need twenty honest minutes and a riff that sounds more expensive than it is.

Drop the sixth string to D. If you have never done this, play the open sixth against the seventh fret of the fifth string. They should agree. If they fight, keep turning.

Put your first finger across the fifth fret of strings six, five, and four. That is a power shape. Hammer the fourth string up to the seventh fret with your third finger, then pull off. Mute the strings with the edge of your picking hand so the notes bark instead of bloom. Count: one-and-two, rest, three-and-four. The rest is the groove. Beginners play every slot. Players leave holes.

Loop that for four minutes with a metronome at 72. Then 80. Then 88. If your fretting hand tenses, you are late. Slow down until it is boring. Boring is how it gets into long-term memory.

Next four minutes: move the same shape to the third fret, then the seventh. Same mute. Same hole in the bar. You are teaching your ear that the riff is a movable object, not a magic trick that only works in one place.

Final block: record your phone pointing at the strings. Watch it back without the sound. You will see the extra motion. Cut it. That is the whole lesson.

I post clips because a riff you can learn tonight is more useful than a lecture about modes. Modes can wait. Your hands cannot. If your fingertips hurt, you practiced. If they are shredded, you practiced with pride instead of patience. Stop, wash, come back tomorrow.

Gear notes, because people ask: any steel-string that stays in tune, a cable that is not crackling, and a cheap tuner. Pedals are dessert. Time is dinner.`;

export const COMEDY_ARTICLE = `My uncle believes the cloud is weather. I used to correct him. Then I realized he is running a better metaphor than most documentation.

He keeps leftover jollof in a blue container and leftover rice in a red one. He does not store the blue inside the red. He does not stack them until the lid pops. He writes the date in biro. When I talk about backups, I now talk about containers.

A backup is not a file you emailed to yourself in 2019. That is a rumor. A backup is a second container, in a second fridge, with a date on it. The cloud is someone else's fridge. You still have to label the box.

This is also how family group chats work. Everyone forwards the same video until the original cook cannot be found. That is not a backup. That is a photocopy of a photocopy. The joke writes itself, which is annoying, because I still have to stand on a stage and pretend I invented it.

I write bits the same way I pack leftovers: small containers, dated, not mixed. A joke about work does not live in the same box as a joke about church. If I dump them together I get a paste, and paste is how you bomb on a Thursday open mic.

If you want to write, steal this method. After something happens, you get one paragraph, not a memoir. Date it. Leave it in the box. A week later, open it and taste. If it still has heat, it is a bit. If it is sour, it was only a complaint.

People on this site ask how comedy earns. Same as cooking and guitar. You publish the thing. Other people look. The ads sit next to the looking. I would rather be paid for a true story about leftover containers than for a dance I cannot do. That is the whole pitch.`;

export function isReelPost(post: { kind: PostKind; videoUrl?: string; coverImage?: string }) {
  if (post.kind === "video" || post.kind === "clip") return !!post.videoUrl;
  if (post.kind === "note") return !!post.coverImage;
  return false;
}

export function postPath(id: string, kind: PostKind) {
  if (kind === "blog" || kind === "story") return `/messages`;
  return `/p/${id}`;
}

export function watchHref(id: string, _opts?: { src?: "feed" | "watch" | "profile"; author?: string }) {
  return `/p/${id}`;
}
