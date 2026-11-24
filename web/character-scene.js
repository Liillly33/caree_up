// Original CharacterCanvas.tsx renderer from caree-up vite, adapted to the existing vanilla frontend.
// Canvas artwork, movement, attacks, day/night sky, equipment and class effects are preserved.
window.CareerupCharacter = (() => {
  let view={},timeMode='auto',tick=0,animationFrameId=0,clockTimer=0,wallHour=12,wallMinute='00',hitUntil=0,hitMonster=null,canvas,ctx;
  function mount(){
    canvas=document.getElementById('cert-character-canvas');if(!canvas || ctx)return;
    ctx=canvas.getContext('2d');if(!ctx)return;
    document.getElementById('cert-time-mode').addEventListener('click',()=>{timeMode=timeMode==='auto'?'day':timeMode==='day'?'night':'auto';updateClock();});
    // High-Resolution Logical coordinates (2x HD Density)
    const logicalWidth = 420;
    const logicalHeight = 240;

    // Pre-calculate fixed star positions for night sky
    const stars = Array.from({ length: 48 }, (_, i) => ({
      x: ((i * 37 + 19) % (logicalWidth - 20)) + 10,
      y: ((i * 23 + 11) % (logicalHeight * 0.52)) + 8,
      size: i % 3 === 0 ? 2 : i % 2 === 0 ? 1.5 : 1,
      flickerSpeed: 0.05 + (i % 5) * 0.03,
      flickerPhase: i * 0.7,
    }));

    // Pre-calculate firefly offsets for night
    const fireflies = Array.from({ length: 9 }, (_, i) => ({
      baseX: 20 + i * 45,
      baseY: logicalHeight * 0.5 + (i % 3) * 16,
      speed: 0.03 + (i % 4) * 0.015,
      phase: i * 1.3,
    }));

    // Stone path offsets
    const stoneOffsets = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448];

    const render = () => {
      if (document.hidden || !canvas.getClientRects().length) { animationFrameId=requestAnimationFrame(render); return; }
      tick++;
      const {level=1,classNameType='전사',showLevelUpAura=false,monster=null}=view;
      const hour=view.hour ?? wallHour;
      const isNight=timeMode==='auto'?(hour<6 || hour>=19):timeMode==='night';

      // Canvas dimensions
      const width = logicalWidth;
      const height = logicalHeight;

      ctx.save();
      // Apply 2x scale for crisp Retina display (840x480 backing canvas)
      ctx.scale(2, 2);

      // ==========================================
      // 1. Dynamic Background: Day / Night Sky
      // ==========================================
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.72);
      if (isNight) {
        skyGrad.addColorStop(0, '#090d16');
        skyGrad.addColorStop(0.5, '#0f172a');
        skyGrad.addColorStop(0.85, '#1e1b4b');
        skyGrad.addColorStop(1, '#2e1065');
      } else {
        skyGrad.addColorStop(0, '#1e3a8a');
        skyGrad.addColorStop(0.35, '#2563eb');
        skyGrad.addColorStop(0.7, '#60a5fa');
        skyGrad.addColorStop(1, '#93c5fd');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Night Sky Stars & Moon OR Day Sky Sun & Fluffy Clouds
      if (isNight) {
        // Flickering Stars
        stars.forEach((star) => {
          const alpha = 0.35 + 0.65 * Math.sin(tick * star.flickerSpeed + star.flickerPhase);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, alpha)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });

        // Glowing Crescent Moon
        const moonX = width * 0.84;
        const moonY = 38;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 32);
        moonGlow.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
        moonGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(moonX - 5, moonY - 3, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Bright Radiant Sun with Golden Corona
        const sunX = width * 0.84;
        const sunY = 38;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 36);
        sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
        sunGlow.addColorStop(0.5, 'rgba(250, 204, 21, 0.3)');
        sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
        ctx.fill();

        // Fluffy Drifting Clouds
        const drawCloud = (cx, cy, scale) => {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.beginPath();
          ctx.arc(cx, cy, 14 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 14 * scale, cy - 4 * scale, 18 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 32 * scale, cy, 15 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 20 * scale, cy + 6 * scale, 12 * scale, 0, Math.PI * 2);
          ctx.fill();
        };

        const cloud1X = ((tick * 0.25) % (width + 120)) - 60;
        const cloud2X = (((tick * 0.15) + 200) % (width + 120)) - 60;
        drawCloud(cloud1X, 36, 0.85);
        drawCloud(cloud2X, 54, 0.65);
      }

      // ==========================================
      // 2. Parallax Distant Mountains
      // ==========================================
      const drawMountainRange = (color, yBase, heightAmp, scrollSpeed) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, yBase);
        const mountainOffset = (tick * scrollSpeed) % 180;
        for (let x = -mountainOffset; x <= width + 180; x += 90) {
          ctx.quadraticCurveTo(x + 45, yBase - heightAmp, x + 90, yBase);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      };

      if (isNight) {
        drawMountainRange('#111827', height * 0.65, 38, 0.2);
        drawMountainRange('#0d1527', height * 0.68, 26, 0.4);
      } else {
        drawMountainRange('#3b82f6', height * 0.65, 38, 0.2);
        drawMountainRange('#2563eb', height * 0.68, 26, 0.4);
      }

      // ==========================================
      // 3. Ground Layer & Cobblestone Path
      // ==========================================
      const groundY = height * 0.72;

      // Lush Top Grass Trim
      ctx.fillStyle = isNight ? '#064e3b' : '#15803d';
      ctx.fillRect(0, groundY, width, 5);

      ctx.fillStyle = isNight ? '#047857' : '#22c55e';
      ctx.fillRect(0, groundY + 1, width, 2);

      // Deep Dirt Soil Foundation
      const dirtGrad = ctx.createLinearGradient(0, groundY + 5, 0, height);
      dirtGrad.addColorStop(0, isNight ? '#1e293b' : '#78350f');
      dirtGrad.addColorStop(1, isNight ? '#0f172a' : '#451a03');
      ctx.fillStyle = dirtGrad;
      ctx.fillRect(0, groundY + 5, width, height - groundY);

      // Cobblestone Adventure Road
      const stoneSpeed = 1.6;
      const stoneShift = (tick * stoneSpeed) % 32;

      stoneOffsets.forEach((bx, idx) => {
        const sx = bx - stoneShift;
        if (sx >= -40 && sx <= width + 40) {
          ctx.fillStyle = isNight ? (idx % 2 === 0 ? '#334155' : '#1e293b') : (idx % 2 === 0 ? '#92400e' : '#b45309');
          ctx.beginPath();
          ctx.roundRect(sx, groundY + 8 + (idx % 2) * 5, 24, 7, 3);
          ctx.fill();

          ctx.fillStyle = isNight ? '#475569' : '#d97706';
          ctx.beginPath();
          ctx.roundRect(sx + 2, groundY + 9 + (idx % 2) * 5, 20, 2, 1);
          ctx.fill();
        }
      });

      // Animated Grass Tufts
      for (let g = 0; g < width + 40; g += 38) {
        const gx = g - ((tick * stoneSpeed) % 38);
        const grassSway = Math.sin((tick * 0.1) + g) * 2;
        ctx.strokeStyle = isNight ? '#10b981' : '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx, groundY);
        ctx.quadraticCurveTo(gx - 3 + grassSway, groundY - 6, gx - 4 + grassSway, groundY - 7);
        ctx.moveTo(gx + 2, groundY);
        ctx.quadraticCurveTo(gx + 2 + grassSway, groundY - 8, gx + 3 + grassSway, groundY - 9);
        ctx.stroke();
      }

      // Fireflies at night
      if (isNight) {
        fireflies.forEach((ff) => {
          const fx = ff.baseX + Math.sin(tick * ff.speed + ff.phase) * 16;
          const fy = ff.baseY + Math.cos(tick * ff.speed * 1.2 + ff.phase) * 8;
          const alpha = 0.3 + 0.7 * Math.abs(Math.sin(tick * 0.08 + ff.phase));
          ctx.fillStyle = `rgba(167, 243, 208, ${alpha})`;
          ctx.beginPath();
          ctx.arc(fx, fy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // ==========================================
      // 4. Original character evolution, extended to maximum Lv.150
      // ==========================================
      const levelTier = (level >= 150 ? 4 : level >= 80 ? 3 : level >= 40 ? 2 : 1);

      const attackPeriod = 130;
      const attackDuration = 36;
      const attackTick = tick % attackPeriod;
      const isAttackingNow = attackTick < attackDuration;
      const attackProgress = isAttackingNow ? attackTick / attackDuration : 0;

      // Leg stride synchronized with ground scroll speed
      const stepPhase = (tick * stoneSpeed) / 16 * Math.PI;
      const walkBob = Math.abs(Math.sin(stepPhase)) * 2.2;

      // Hero Position
      const heroXBase = width * 0.30;
      const attackLunge = isAttackingNow ? Math.sin(attackProgress * Math.PI) * 12 : 0;
      const heroX = heroXBase + attackLunge;
      const heroY = groundY - 44 + walkBob;

      // Character Shadow
      ctx.fillStyle = isNight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(heroX + 16, groundY + 2, 16 + (levelTier >= 4 ? 6 : levelTier >= 3 ? 3 : 0), 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Magical Aura (Radial Glow by Tier)
      const auraPulse = Math.sin(tick * 0.1) * 0.12;
      let auraColor = 'rgba(59, 130, 246, ';
      if (classNameType === '마법사') auraColor = 'rgba(168, 85, 247, ';
      else if (classNameType === '성직자') auraColor = 'rgba(250, 204, 21, ';

      if (levelTier === 4) {
        // Divine Rainbow / Imperial Golden Aura for Max Tier
        auraColor = 'rgba(251, 191, 36, ';
      }

      const auraRadius = 24 + levelTier * 7 + (isAttackingNow ? 10 : 0);
      ctx.fillStyle = `${auraColor}${0.18 + levelTier * 0.08 + auraPulse})`;
      ctx.beginPath();
      ctx.arc(heroX + 16, heroY + 24, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // Radiant Aura Rings for Tier 3 & 4
      if (levelTier >= 3) {
        ctx.strokeStyle = `${auraColor}${0.45 + auraPulse})`;
        ctx.lineWidth = levelTier === 4 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.ellipse(heroX + 16, groundY + 5, auraRadius * 1.15, auraRadius * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Tier 4 Orbiting Golden Rune Stars
        if (levelTier === 4) {
          for (let starIdx = 0; starIdx < 4; starIdx++) {
            const starAngle = (tick * 0.05) + (starIdx * (Math.PI / 2));
            const orX = heroX + 16 + Math.cos(starAngle) * (auraRadius * 0.9);
            const orY = heroY + 20 + Math.sin(starAngle) * (auraRadius * 0.6);
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(orX, orY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ==========================================
      // 5. Tiered Capes & Wings (Drawn behind body)
      // ==========================================
      if (classNameType === '기사' || classNameType === '전사') {
        if (levelTier >= 3) {
              const capeWiggle = Math.sin(tick * 0.2) * 5;
          ctx.fillStyle = levelTier === 4 ? '#581c87' : '#dc2626';
          ctx.beginPath();
          ctx.moveTo(heroX + 12, heroY + 22);
          ctx.quadraticCurveTo(heroX - 8 + capeWiggle, heroY + 30, heroX - 16 + capeWiggle, heroY + 44);
          ctx.quadraticCurveTo(heroX - 4 + capeWiggle, heroY + 46, heroX + 16, heroY + 38);
          ctx.closePath();
          ctx.fill();

          if (levelTier === 4) {
            // Gold Ermine Fur Trim on King Mantle
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      } else if (classNameType === '성직자') {
        if (levelTier >= 3) {
          // Radiant Angelic Wings (Tier 3: 2 Wings, Tier 4: 4 Seraph Wings)
          const wingFlap = Math.sin(tick * 0.15) * 6;
          const drawWing = (wx, wy, angle, scale) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(angle);
            ctx.fillStyle = levelTier === 4 ? 'rgba(254, 240, 138, 0.85)' : 'rgba(250, 204, 21, 0.7)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-15 * scale, -18 * scale, -30 * scale, -8 * scale);
            ctx.quadraticCurveTo(-16 * scale, 4 * scale, 0, 0);
            ctx.fill();
            ctx.restore();
          };

          drawWing(heroX + 10, heroY + 22, -0.2 + (wingFlap * 0.03), 1);
          drawWing(heroX + 22, heroY + 22, 0.2 - (wingFlap * 0.03), 1);

          if (levelTier === 4) {
            // Upper Seraph Wings
            drawWing(heroX + 8, heroY + 16, -0.5 + (wingFlap * 0.04), 1.25);
            drawWing(heroX + 24, heroY + 16, 0.5 - (wingFlap * 0.04), 1.25);
          }
        }
      } else if (classNameType === '마법사') {
        if (levelTier >= 3) {
          // Floating Celestial Magic Circles behind back
          const ringPulse = Math.sin(tick * 0.08) * 4;
          ctx.strokeStyle = levelTier === 4 ? 'rgba(236, 72, 153, 0.75)' : 'rgba(168, 85, 247, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(heroX + 16, heroY + 24, 22 + ringPulse, 0, Math.PI * 2);
          ctx.stroke();

          if (levelTier === 4) {
            // Cosmic Nebula Stardust Trails
            for (let i = 0; i < 6; i++) {
              const dustAngle = (tick * 0.04) + (i * Math.PI / 3);
              const dx = heroX + 16 + Math.cos(dustAngle) * 26;
              const dy = heroY + 24 + Math.sin(dustAngle) * 16;
              ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#ec4899';
              ctx.beginPath();
              ctx.arc(dx, dy, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // ==========================================
      // 6. Rounded Chibi Legs & Boots
      // ==========================================
      const hipY = heroY + 33;
      const maxLegAngle = 0.38;
      const leftLegAngle = Math.sin(stepPhase) * maxLegAngle;
      const rightLegAngle = -Math.sin(stepPhase) * maxLegAngle;

      const drawCurvedLeg = (hipX, angle, isFrontLeg) => {
        ctx.save();
        ctx.translate(hipX, hipY);
        ctx.rotate(angle);

        // Tapered Curved Thigh/Pants
        let legColor = isNight ? '#0f172a' : (isFrontLeg ? '#1e293b' : '#0f172a');
        if (levelTier === 4 && (classNameType === '기사' || classNameType === '전사')) legColor = '#d97706';
        if (levelTier >= 3 && classNameType === '성직자') legColor = '#f8fafc';

        ctx.fillStyle = legColor;
        ctx.beginPath();
        ctx.ellipse(0, 6, 3.5, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boot Colors by Tier
        let bootColor = isFrontLeg ? '#b45309' : '#78350f';
        let cuffColor = isFrontLeg ? '#d97706' : '#92400e';

        if (levelTier >= 4) {
          bootColor = isFrontLeg ? '#f59e0b' : '#d97706';
          cuffColor = '#fef08a';
        } else if (levelTier >= 2) {
          bootColor = isFrontLeg ? '#475569' : '#334155';
          cuffColor = isFrontLeg ? '#94a3b8' : '#64748b';
        }

        ctx.fillStyle = bootColor;
        ctx.beginPath();
        ctx.ellipse(1, 13, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = cuffColor;
        ctx.beginPath();
        ctx.ellipse(0, 10, 4, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      if (leftLegAngle > rightLegAngle) {
        drawCurvedLeg(heroX + 21, rightLegAngle, false);
        drawCurvedLeg(heroX + 11, leftLegAngle, true);
      } else {
        drawCurvedLeg(heroX + 11, leftLegAngle, false);
        drawCurvedLeg(heroX + 21, rightLegAngle, true);
      }

      // ==========================================
      // 7. Evolving Torso & Armor Outfits by Tier
      // ==========================================
      const torsoCenterX = heroX + 16;
      const torsoCenterY = heroY + 27;

      if (classNameType === '마법사') {
        // Robe base color
        let robeBase = '#3b0764'; // Tier 1: simple dark purple
        let innerVest = '#6b21a8';
        let sashColor = '#a855f7';

        if (levelTier === 2) {
          robeBase = '#581c87';
          innerVest = '#9333ea';
          sashColor = '#fbbf24';
        } else if (levelTier === 3) {
          robeBase = '#3b0764';
          innerVest = '#7e22ce';
          sashColor = '#facc15';
        } else if (levelTier === 4) {
          robeBase = '#1e1b4b'; // Deep cosmic indigo
          innerVest = '#4c1d95';
          sashColor = '#f43f5e';
        }

        ctx.fillStyle = robeBase;
        ctx.beginPath();
        ctx.moveTo(torsoCenterX - 8, torsoCenterY - 10);
        ctx.quadraticCurveTo(torsoCenterX - 14, torsoCenterY + 12, torsoCenterX - 11, torsoCenterY + 12);
        ctx.quadraticCurveTo(torsoCenterX, torsoCenterY + 15, torsoCenterX + 11, torsoCenterY + 12);
        ctx.quadraticCurveTo(torsoCenterX + 14, torsoCenterY + 12, torsoCenterX + 8, torsoCenterY - 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = innerVest;
        ctx.beginPath();
        ctx.ellipse(torsoCenterX, torsoCenterY, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tier 4 Cosmic Star Embroidery
        if (levelTier >= 3) {
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(torsoCenterX, torsoCenterY - 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = sashColor;
        ctx.beginPath();
        ctx.ellipse(torsoCenterX, torsoCenterY + 4, 9, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (classNameType === '성직자') {
        let robeColor = '#f1f5f9'; // Tier 1
        let crossColor = '#b45309';

        if (levelTier === 2) {
          robeColor = '#f8fafc';
          crossColor = '#3b82f6';
        } else if (levelTier === 3) {
          robeColor = '#ffffff';
          crossColor = '#eab308';
        } else if (levelTier === 4) {
          robeColor = '#fefce8';
          crossColor = '#ffd700';
        }

        ctx.fillStyle = robeColor;
        ctx.beginPath();
        ctx.ellipse(torsoCenterX, torsoCenterY + 1, 11, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = crossColor;
        ctx.beginPath();
        ctx.arc(torsoCenterX, torsoCenterY, levelTier >= 3 ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(torsoCenterX - 1.5, torsoCenterY - 6, 3, 12);
        ctx.fillRect(torsoCenterX - 5, torsoCenterY - 2.5, 10, 3);
      } else {
        // Knight: 견습기사 -> 정식기사 -> 성기사 -> 국왕
        if (levelTier === 1) {
              ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 1, 10, 9.5, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#b45309';
          ctx.fillRect(torsoCenterX - 2, torsoCenterY - 6, 4, 12);

          // Leather Belt
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 5, 8.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 2) {
              ctx.fillStyle = '#2563eb';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 1, 11, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY - 1, 7, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(torsoCenterX - 10, torsoCenterY - 5, 4.5, 0, Math.PI * 2);
          ctx.arc(torsoCenterX + 10, torsoCenterY - 5, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 5, 9.5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 3) {
              ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 1, 11.5, 10.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Gold Trim Chestplate
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY - 1, 7.5, 7.5, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY - 1, 5, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Gold Pauldrons
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(torsoCenterX - 11, torsoCenterY - 5, 5.5, 0, Math.PI * 2);
          ctx.arc(torsoCenterX + 11, torsoCenterY - 5, 5.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
              ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(torsoCenterX, torsoCenterY + 1, 12, 11, 0, 0, Math.PI * 2);
          ctx.fill();

          // Radiant Sun Crest
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(torsoCenterX, torsoCenterY - 1, 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Sapphire Royal Gem
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(torsoCenterX, torsoCenterY - 1, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Imperial Gold Pauldrons
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(torsoCenterX - 11, torsoCenterY - 5, 6, 0, Math.PI * 2);
          ctx.arc(torsoCenterX + 11, torsoCenterY - 5, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(torsoCenterX - 11, torsoCenterY - 5, 3, 0, Math.PI * 2);
          ctx.arc(torsoCenterX + 11, torsoCenterY - 5, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ==========================================
      // 8. Chibi Head & Exposed Cute Face
      // ==========================================
      const headCenterX = heroX + 16;
      const headCenterY = heroY + 14;
      const headRadius = 9.5;

      // Head Base (Skin Tone Circle)
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Front Hair Bangs
      if (classNameType === '기사' || classNameType === '전사') {
        ctx.fillStyle = levelTier === 4 ? '#b45309' : '#475569';
        ctx.beginPath();
        ctx.ellipse(headCenterX - 1, headCenterY - 5, 7, 3, 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }

      // Cheerful Soft Pink Cheeks
      ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
      ctx.beginPath();
      ctx.arc(headCenterX + 3.5, headCenterY + 3.2, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Expressive Chibi Eye
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(headCenterX + 3.5, headCenterY - 0.5, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight Sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headCenterX + 2.8, headCenterY - 1.5, 1, 0, Math.PI * 2);
      ctx.arc(headCenterX + 4.2, headCenterY + 1, 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Cute Smile
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(headCenterX + 2.5, headCenterY + 2.5, 1.8, 0.1, Math.PI * 0.9);
      ctx.stroke();

      // ==========================================
      // 9. Evolving Hats, Helmets & Crowns by Tier
      // ==========================================
      if (classNameType === '마법사') {
        if (levelTier === 1) {
              ctx.fillStyle = '#4c1d95';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 5, 8.5, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 2) {
              ctx.fillStyle = '#581c87';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 5, 12, 3.5, -0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(headCenterX - 8, headCenterY - 6);
          ctx.quadraticCurveTo(headCenterX - 1, headCenterY - 20, headCenterX + 12, headCenterY - 18);
          ctx.quadraticCurveTo(headCenterX + 4, headCenterY - 11, headCenterX + 8, headCenterY - 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(headCenterX + 4, headCenterY - 7, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 3) {
              ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 5, 13, 3.8, -0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(headCenterX - 8, headCenterY - 6);
          ctx.quadraticCurveTo(headCenterX - 3, headCenterY - 24, headCenterX + 14, headCenterY - 22);
          ctx.quadraticCurveTo(headCenterX + 5, headCenterY - 12, headCenterX + 8, headCenterY - 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(headCenterX + 5, headCenterY - 9, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
              ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 8, 10, 3.5, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Star crests on Halo
          for (let star = 0; star < 3; star++) {
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(headCenterX - 6 + star * 6, headCenterY - 11, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (classNameType === '성직자') {
        if (levelTier === 1) {
              ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 5, 8.5, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 2) {
              ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(headCenterX, headCenterY - 2, 9.5, Math.PI * 0.9, Math.PI * 2.1);
          ctx.fill();

          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 4, 9, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(headCenterX + 2, headCenterY - 5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (levelTier === 3) {
              ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(headCenterX, headCenterY - 2, 10, Math.PI * 0.9, Math.PI * 2.1);
          ctx.fill();

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(headCenterX - 8, headCenterY - 4);
          ctx.lineTo(headCenterX - 4, headCenterY - 12);
          ctx.lineTo(headCenterX, headCenterY - 7);
          ctx.lineTo(headCenterX + 4, headCenterY - 12);
          ctx.lineTo(headCenterX + 8, headCenterY - 4);
          ctx.closePath();
          ctx.fill();
        } else {
              ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 12, 12, 4, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.moveTo(headCenterX - 7, headCenterY - 4);
          ctx.lineTo(headCenterX - 5, headCenterY - 14);
          ctx.lineTo(headCenterX, headCenterY - 9);
          ctx.lineTo(headCenterX + 5, headCenterY - 14);
          ctx.lineTo(headCenterX + 7, headCenterY - 4);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Knight Headwear: 견습기사 -> 정식기사 -> 성기사 -> 국왕
        if (levelTier === 1) {
              ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 4, 8.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
          // Headband knot flapping back
          ctx.fillRect(headCenterX - 8, headCenterY - 5, 3, 6);
        } else if (levelTier === 2) {
              ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(headCenterX - 1, headCenterY - 4, 8.5, Math.PI * 0.9, Math.PI * 2.1);
          ctx.fill();

          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 4, 8.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();

          const plumeWiggle = Math.sin(tick * 0.25) * 3;
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(headCenterX - 2, headCenterY - 12);
          ctx.quadraticCurveTo(headCenterX - 11 + plumeWiggle, headCenterY - 18, headCenterX - 16 + plumeWiggle, headCenterY - 12);
          ctx.quadraticCurveTo(headCenterX - 9 + plumeWiggle, headCenterY - 10, headCenterX - 2, headCenterY - 8);
          ctx.closePath();
          ctx.fill();
        } else if (levelTier === 3) {
              ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.arc(headCenterX - 1, headCenterY - 4, 9, Math.PI * 0.9, Math.PI * 2.1);
          ctx.fill();

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 4, 9, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          const plumeWiggle = Math.sin(tick * 0.25) * 4;
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.moveTo(headCenterX - 2, headCenterY - 13);
          ctx.quadraticCurveTo(headCenterX - 14 + plumeWiggle, headCenterY - 24, headCenterX - 22 + plumeWiggle, headCenterY - 14);
          ctx.quadraticCurveTo(headCenterX - 11 + plumeWiggle, headCenterY - 10, headCenterX - 2, headCenterY - 8);
          ctx.closePath();
          ctx.fill();
        } else {
              ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.moveTo(headCenterX - 9, headCenterY - 4);
          ctx.lineTo(headCenterX - 7, headCenterY - 14);
          ctx.lineTo(headCenterX - 3, headCenterY - 8);
          ctx.lineTo(headCenterX, headCenterY - 16); // High center point
          ctx.lineTo(headCenterX + 3, headCenterY - 8);
          ctx.lineTo(headCenterX + 7, headCenterY - 14);
          ctx.lineTo(headCenterX + 9, headCenterY - 4);
          ctx.closePath();
          ctx.fill();

          // Crown Jewels
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(headCenterX, headCenterY - 13, 2, 0, Math.PI * 2);
          ctx.arc(headCenterX - 6, headCenterY - 11, 1.5, 0, Math.PI * 2);
          ctx.arc(headCenterX + 6, headCenterY - 11, 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(headCenterX, headCenterY - 4, 9.5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ==========================================
      // 10. Evolving Weapons & Battle Visual Effects
      // ==========================================
      if (classNameType === '마법사') {
        const staffYOffset = isAttackingNow ? -10 * Math.sin(attackProgress * Math.PI) : 0;

        if (levelTier === 1) {
              ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(heroX + 27, heroY + 36 + staffYOffset);
          ctx.lineTo(heroX + 26, heroY + 16 + staffYOffset);
          ctx.stroke();

          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.arc(heroX + 26, heroY + 14 + staffYOffset, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Curved Greatstaff with Glowing Crystal Orb
          ctx.strokeStyle = levelTier === 4 ? '#f59e0b' : '#78350f';
          ctx.lineWidth = levelTier >= 3 ? 4 : 3.5;
          ctx.beginPath();
          ctx.moveTo(heroX + 27, heroY + 38 + staffYOffset);
          ctx.quadraticCurveTo(heroX + 28, heroY + 20 + staffYOffset, heroX + 26, heroY + 8 + staffYOffset);
          ctx.stroke();

          const orbX = heroX + 26;
          const orbY = heroY + 4 + staffYOffset;
          const orbRadius = 5 + levelTier * 1.5 + (isAttackingNow ? 2 : 0);

          const orbGlow = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, orbRadius * 2.2);
          orbGlow.addColorStop(0, '#ffffff');
          orbGlow.addColorStop(0.5, levelTier === 4 ? '#ec4899' : levelTier === 3 ? '#a855f7' : '#c084fc');
          orbGlow.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = orbGlow;
          ctx.beginPath();
          ctx.arc(orbX, orbY, orbRadius * 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = levelTier === 4 ? '#f43f5e' : levelTier === 3 ? '#9333ea' : '#c084fc';
          ctx.beginPath();
          ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isAttackingNow) {
          const castX = heroX + 32;
          const castY = heroY + 6 + staffYOffset;

          if (levelTier === 1) {
                  ctx.fillStyle = '#c084fc';
            ctx.beginPath();
            ctx.arc(castX + attackProgress * 40, castY, 6, 0, Math.PI * 2);
            ctx.fill();
          } else if (levelTier === 2) {
                  const projX = castX + attackProgress * 120;
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.arc(projX, castY, 9, 0, Math.PI * 2);
            ctx.fill();
          } else if (levelTier === 3) {
                  ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(castX + 15, castY, 24, 0, Math.PI * 2);
            ctx.stroke();

            const projX = castX + attackProgress * 160;
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(projX, castY, 13, 0, Math.PI * 2);
            ctx.fill();
          } else {
                  const beamGrad = ctx.createLinearGradient(castX, castY, width, castY);
            beamGrad.addColorStop(0, 'rgba(236, 72, 153, 0.95)');
            beamGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.98)');
            beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.9)');
            ctx.fillStyle = beamGrad;
            ctx.fillRect(castX, castY - 14, width - castX, 28);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            
          }
        }
      } else if (classNameType === '성직자') {
        const maceYOffset = isAttackingNow ? -12 * Math.sin(attackProgress * Math.PI) : 0;

        if (levelTier === 1) {
              ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.roundRect(heroX + 26, heroY + 20 + maceYOffset, 5, 14, 2);
          ctx.fill();
        } else {
          // Sceptre by Tier
          ctx.fillStyle = levelTier >= 3 ? '#f59e0b' : '#94a3b8';
          ctx.beginPath();
          ctx.roundRect(heroX + 26, heroY + 16 + maceYOffset, 6, 18, 3);
          ctx.fill();

          ctx.fillStyle = levelTier === 4 ? '#ffd700' : '#fef08a';
          ctx.beginPath();
          ctx.arc(heroX + 29, heroY + 14 + maceYOffset, 6 + (levelTier >= 3 ? 2 : 0), 0, Math.PI * 2);
          ctx.fill();
        }

        if (isAttackingNow) {
          const holyX = heroX + 16;
          const beamWidth = 16 + levelTier * 16;
          const beamGrad = ctx.createLinearGradient(0, 0, 0, groundY);
          beamGrad.addColorStop(0, `rgba(254, 240, 138, ${0.9 - attackProgress * 0.4})`);
          beamGrad.addColorStop(1, 'rgba(250, 204, 21, 0.15)');
          ctx.fillStyle = beamGrad;
          ctx.fillRect(holyX - beamWidth / 2, 0, beamWidth, groundY + 10);

          if (levelTier >= 4) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
           
          }
        }
      } else {
        // Knight: 견습기사 -> 정식기사 -> 성기사 -> 국왕
        ctx.save();
        const swingAngle = isAttackingNow
          ? -1.2 + attackProgress * 3.4
          : Math.sin(tick * 0.15) * 0.2;

        ctx.translate(heroX + 26, heroY + 22);
        ctx.rotate(swingAngle);

        if (levelTier === 1) {
              ctx.fillStyle = '#92400e';
          ctx.beginPath();
          ctx.roundRect(-2, -20, 4, 22, 2);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-1, 2, 2, 6);
        } else {
          // Tier 2, 3, 4 Broadsword
          const bladeLen = 22 + levelTier * 4;
          let bladeColor = '#cbd5e1';
          if (levelTier === 3) bladeColor = '#38bdf8'; // Holy Azure
          if (levelTier === 4) bladeColor = '#fef08a'; // Radiant Excalibur Gold

          ctx.fillStyle = bladeColor;
          ctx.beginPath();
          ctx.moveTo(-2, 0);
          ctx.lineTo(-2, -bladeLen);
          ctx.lineTo(0, -bladeLen - 5);
          ctx.lineTo(3, -bladeLen);
          ctx.lineTo(3, 0);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, -bladeLen + 2, 1.5, bladeLen - 4);

          // Guard & Handle
          ctx.fillStyle = levelTier >= 3 ? '#ffd700' : '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 + levelTier, 2.8, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#78350f';
          ctx.fillRect(-1, 2, 3, 6);
        }
        ctx.restore();

        // Shields in Left Hand
        if (levelTier === 1) {
              ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(heroX + 4, heroY + 26, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (levelTier === 2) {
              ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.arc(heroX + 4, heroY + 26, 9.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Tier 3 & 4: Golden Lion Crest Aegis Shield
          ctx.fillStyle = levelTier === 4 ? '#b45309' : '#1e3a8a';
          ctx.beginPath();
          ctx.arc(heroX + 4, heroY + 26, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(heroX + 4, heroY + 26, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Attack Slash FX
        if (isAttackingNow) {
          const slashX = heroX + 28;
          const slashY = heroY + 12;
          const slashRadius = 24 + levelTier * 12;

          if (levelTier === 1) {
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(slashX + attackProgress * 20, slashY, slashRadius * 0.7, -Math.PI * 0.5, Math.PI * 0.2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = levelTier === 4 ? '#ffd700' : levelTier === 3 ? '#38bdf8' : '#e2e8f0';
            ctx.lineWidth = 3 + levelTier * 2;
            ctx.beginPath();
            ctx.arc(slashX + attackProgress * 30, slashY, slashRadius, -Math.PI * 0.6, Math.PI * 0.4);
            ctx.stroke();

            if (levelTier >= 3) {
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(slashX + attackProgress * 40, slashY - 6, slashRadius * 0.8, -Math.PI * 0.5, Math.PI * 0.3);
              ctx.stroke();
            }

            if (levelTier >= 4) {
              ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
              ctx.fillRect(0, 0, width, height);

              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
             
            }
          }
        }
      }

      // ==========================================
      // 11. Floating Class & Tier Title Badge
      // ==========================================
      let tierTitle = `Lv.${level}`;
      if (classNameType === '기사' || classNameType === '전사') {
        tierTitle = levelTier === 4 ? `👑 Lv.${level} 국왕` : levelTier === 3 ? `⚔️ Lv.${level} 성기사` : levelTier === 2 ? `🛡️ Lv.${level} 정식기사` : `Lv.${level} 견습기사`;
      } else if (classNameType === '마법사') {
        tierTitle = levelTier === 4 ? `🌌 Lv.${level} 대현자` : levelTier === 3 ? `🔮 Lv.${level} 대마법사` : levelTier === 2 ? `✨ Lv.${level} 정식마법사` : `Lv.${level} 견습마법사`;
      } else if (classNameType === '성직자') {
        tierTitle = levelTier === 4 ? `🕊️ Lv.${level} 교황` : levelTier === 3 ? `☀️ Lv.${level} 고위주교` : levelTier === 2 ? `📖 Lv.${level} 정식사제` : `Lv.${level} 견습수도사`;
      }

      const badgeWidth = Math.max(50, tierTitle.length * 7.5 + 16);
      ctx.fillStyle = levelTier === 4 ? 'rgba(88, 28, 135, 0.92)' : 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(heroX + 16 - badgeWidth / 2, heroY - 26, badgeWidth, 15, 3.5);
      ctx.fill();

      if (levelTier >= 3) {
        ctx.strokeStyle = levelTier === 4 ? '#ffd700' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = levelTier === 4 ? '#ffd700' : levelTier === 3 ? '#fef08a' : '#38bdf8';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tierTitle, heroX + 16, heroY - 15);
      ctx.textAlign = 'start';

      // Level Up Golden Radiance Beam
      if (showLevelUpAura) {
        const beamGrad = ctx.createLinearGradient(0, 0, 0, groundY + 10);
        beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.7)');
        beamGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.5)');
        beamGrad.addColorStop(1, 'rgba(234, 179, 8, 0.15)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(heroX - 8, 0, 48, groundY + 10);

        const ringRadius = 20 + ((tick * 1.5) % 35);
        const ringAlpha = Math.max(0, 1 - ringRadius / 55);
        ctx.strokeStyle = `rgba(254, 240, 138, ${ringAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(heroX + 16, groundY + 5, ringRadius * 1.2, ringRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (monster || performance.now()<hitUntil) {
        const hitAge=Math.max(0,650-(hitUntil-performance.now())),hitting=performance.now()<hitUntil;
        const enemyType=hitting?hitMonster:monster;
        const mx=width*.78,my=groundY-15+Math.sin(tick*.06)*4;
        ctx.save(); ctx.translate(mx+(hitting?Math.sin(hitAge*.12)*7*(1-hitAge/650):0),my);
        if(hitting)ctx.globalAlpha=Math.max(0,1-hitAge/650);
        const big=enemyType==='final', mid=enemyType!=='daily' && !big;
        const radius=big?29:mid?23:17;
        ctx.shadowColor=big?'#fb7185':mid?'#c084fc':'#34d399';ctx.shadowBlur=15;
        ctx.fillStyle=big?'#9f1239':mid?'#6d28d9':'#059669';
        ctx.beginPath();ctx.ellipse(0,0,radius,radius*.8,0,Math.PI,0);ctx.lineTo(radius,radius*.45);ctx.quadraticCurveTo(0,radius*.85,-radius,radius*.45);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle='#fef3c7';
        for (const x of [-radius*.35,radius*.35]){ctx.beginPath();ctx.arc(x,-3,3,0,Math.PI*2);ctx.fill();}
        if(mid || big){ctx.fillStyle=big?'#fbbf24':'#c4b5fd';for(const x of [-1,1]){ctx.beginPath();ctx.moveTo(x*radius*.6,-radius*.5);ctx.lineTo(x*radius*.9,-radius*1.2);ctx.lineTo(x*radius*.2,-radius*.7);ctx.fill();}}
        if(isAttackingNow && attackProgress>.6){ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(-radius,0,7*Math.sin(attackProgress*Math.PI),0,Math.PI*2);ctx.fill();}
        ctx.restore();
        if(hitting){
          const f=hitAge/650;ctx.save();ctx.translate(mx,my);ctx.strokeStyle=`rgba(254,240,138,${1-f})`;ctx.lineWidth=3*(1-f)+1;
          for(let i=0;i<12;i++){const angle=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(angle)*(12+f*16),Math.sin(angle)*(12+f*16));ctx.lineTo(Math.cos(angle)*(25+f*42),Math.sin(angle)*(25+f*42));ctx.stroke();}
          ctx.fillStyle=`rgba(255,251,235,${(1-f)*.9})`;ctx.beginPath();ctx.arc(0,0,20*(1-f),0,Math.PI*2);ctx.fill();
          ctx.fillStyle=`rgba(253,224,71,${1-f})`;ctx.font='900 15px sans-serif';ctx.textAlign='center';ctx.fillText('CRITICAL!',0,-34-f*28);ctx.restore();
        }
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    clockTimer=setInterval(updateClock,30000);updateClock();render();
  }
  function updateClock(){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    wallHour=Number(parts.find(p=>p.type==='hour').value);wallMinute=parts.find(p=>p.type==='minute').value;
    const button=document.getElementById('cert-time-mode');if(!button)return;
    const hour=view.hour ?? wallHour;
    const night=timeMode==='auto'?(hour<6 || hour>=19):timeMode==='night';
    button.textContent=`${night?'☾':'☀'} ${timeMode==='auto'?String(hour).padStart(2,'0')+':'+(view.minute ?? wallMinute)+' · 자동':night?'밤 모드':'낮 모드'}`;
  }
  return {hit(monster){hitMonster=monster;hitUntil=performance.now()+650;},update(next){view={...next};mount();updateClock();},stop(){cancelAnimationFrame(animationFrameId);clearInterval(clockTimer);ctx=null;view={};hitUntil=0;hitMonster=null;}};
})();
