#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fetchPhotos, downloadImage, fetchGroups, fetchPhotosByGroup } from './api/pocketbase.js';
import { generateVideo, TRANSITIONS, KEN_BURNS_PATTERN_NAMES, INTRO_OUTRO_PRESETS } from './video/generator.js';
import { generateThumbnail, generateBestThumbnail, TEXT_OVERLAY_STYLES } from './video/thumbnail.js';
import { getTemplateList, getTemplateNames, applyTemplate, TEMPLATES } from './video/templates.js';
import { generatePreview, estimatePreviewTime, PREVIEW_PRESETS } from './video/preview.js';
import { generateSubtitles, checkAvailability, PROMPT_TYPES, QUALITY_LEVELS } from './ai/subtitle-generator.js';
import { READING_SPEED_PRESETS } from './video/duration-calculator.js';
import { applyBeatSync, getBeatSyncSummary, BPM_PRESETS, BPM_PRESET_NAMES } from './audio/beat-sync.js';
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../config.json'), 'utf-8'));

// Ensure temp directory exists
const tempDir = join(__dirname, '../temp');
mkdirSync(tempDir, { recursive: true });

const program = new Command();

program
  .name('shorts-gen')
  .description('클라우드 이미지로 쇼츠 영상 생성')
  .version('1.0.0');

// Groups command
program
  .command('groups')
  .description('그룹(제품) 목록 조회')
  .option('-n, --limit <number>', '조회할 개수', '20')
  .option('--since <date>', '특정 날짜 이후 (YYYY-MM-DD)')
  .option('--sort <order>', '정렬 기준 (newest|oldest|title)', 'newest')
  .action(async (options) => {
    const spinner = ora('그룹 목록 조회 중...').start();
    try {
      const groups = await fetchGroups({
        limit: parseInt(options.limit),
        since: options.since,
        sort: options.sort
      });
      spinner.succeed(`${groups.length}개 그룹 조회 완료`);

      if (groups.length === 0) {
        console.log(chalk.yellow('\n그룹이 없습니다.'));
        return;
      }

      console.log('\n' + chalk.bold('📁 그룹 목록:'));
      groups.forEach((group, i) => {
        console.log(`  ${chalk.gray(`[${i + 1}]`)} ${chalk.white(group.title)}`);
        console.log(`      ${chalk.dim(group.id)}`);
      });
    } catch (err) {
      spinner.fail('조회 실패: ' + err.message);
      console.error(chalk.dim(err.stack));
    }
  });

// List command
program
  .command('list')
  .description('PocketBase에서 사진 목록 조회')
  .option('-n, --limit <number>', '조회할 개수', '20')
  .option('--since <date>', '특정 날짜 이후 (YYYY-MM-DD)')
  .option('-g, --group <id>', '특정 그룹의 사진만 조회')
  .option('--sort <order>', '정렬 기준 (newest|oldest|title)', 'newest')
  .action(async (options) => {
    const spinner = ora('사진 목록 조회 중...').start();
    try {
      const photos = await fetchPhotos({
        limit: parseInt(options.limit),
        since: options.since,
        groupId: options.group,
        sort: options.sort
      });
      spinner.succeed(`${photos.length}개 사진 조회 완료`);

      if (photos.length === 0) {
        console.log(chalk.yellow('\n사진이 없습니다.'));
        return;
      }

      console.log('\n' + chalk.bold('📸 사진 목록:'));
      photos.forEach((photo, i) => {
        const groupInfo = photo.groupTitle ? chalk.cyan(`[${photo.groupTitle}] `) : '';
        console.log(`  ${chalk.gray(`[${i + 1}]`)} ${groupInfo}${chalk.white(photo.title)}`);
        console.log(`      ${chalk.dim(photo.id)}`);
      });
    } catch (err) {
      spinner.fail('조회 실패: ' + err.message);
      console.error(chalk.dim(err.stack));
    }
  });

// Create command
program
  .command('create')
  .description('영상 생성')
  .option('-a, --auto', '자동 모드 (최신 사진 사용)')
  .option('-n, --count <number>', '사진 개수', '5')
  .option('-g, --group <id>', '특정 그룹의 사진으로 영상 생성')
  .option('-o, --output <path>', '출력 경로')
  .option('--bgm <path>', 'BGM 파일 경로')
  .option('--logo <path>', '로고 이미지 경로')
  .option('--no-logo', '로고 비활성화')
  .option('--transition <name>', '전환 효과', 'directionalwipe')
  .option('--ids <ids>', '사진 ID 목록 (쉼표 구분)')
  .option('--thumbnail', '영상 생성 후 썸네일 자동 생성')
  .option('--thumbnail-pos <pos>', '썸네일 위치 (start/middle/end 또는 초)', 'middle')
  .option('--thumbnail-text <text>', '썸네일 텍스트 오버레이')
  .option('--thumbnail-style <style>', '썸네일 텍스트 스타일 (default/banner/centered/minimal)', 'default')
  .option('--thumbnail-best', '최적 프레임 자동 선택 (5개 후보 비교)')
  .option('-t, --template <name>', '영상 템플릿 (classic, dynamic, elegant, minimal, quick, cinematic 등)')
  .option('--ken-burns-mode <mode>', 'Ken Burns 패턴 모드 (classic/sequential/random)', 'sequential')
  .option('--intro <text>', '인트로 텍스트 (예: 브랜드명)')
  .option('--intro-preset <preset>', '인트로 프리셋 (simple/brand/minimal)', 'simple')
  .option('--outro <text>', '아웃트로 텍스트 (예: Thank you)')
  .option('--outro-sub <text>', '아웃트로 서브 텍스트 (예: 구독 부탁)')
  .option('--outro-preset <preset>', '아웃트로 프리셋 (simple/brand/cta)', 'cta')
  .option('--preview', '저해상도 미리보기 영상만 생성')
  .option('--preview-quality <quality>', '미리보기 품질 (fast/balanced/quality)', 'fast')
  .option('--ai-subtitle', 'AI로 마케팅 자막 자동 생성 (GOOGLE_API_KEY 필요)')
  .option('--prompt-template <type>', 'AI 프롬프트 템플릿 (default/product/food/wheelRestoration)', 'default')
  .option('--ai-quality <level>', 'AI 자막 품질 레벨 (creative/balanced/conservative)', 'balanced')
  .option('--ai-review', 'AI 자막 생성 후 수정 기회 제공')
  .option('--reading-speed <speed>', '읽기 속도 (slow/normal/fast 또는 CPM 숫자)', 'normal')
  .option('--beat-sync <bpm>', 'BGM 비트 동기화 (slow/medium/upbeat/fast 또는 BPM 숫자)')
  .option('--sort <order>', '정렬 기준 (newest|oldest|title)', 'newest')
  .action(async (options) => {
    try {
      let selectedPhotos;
      let selectedGroupTitle = null;

      if (options.ids) {
        // ID로 직접 지정
        const ids = options.ids.split(',').map(id => id.trim());
        const spinner = ora('사진 조회 중...').start();
        const allPhotos = await fetchPhotos({ limit: 100 });
        selectedPhotos = allPhotos.filter(p => ids.includes(p.id));
        spinner.succeed(`${selectedPhotos.length}개 사진 선택됨`);
      } else if (options.group) {
        // 그룹 지정 모드
        const spinner = ora(`그룹 사진 조회 중...`).start();
        const photos = await fetchPhotosByGroup(options.group, { limit: 50, sort: options.sort });
        spinner.succeed(`${photos.length}개 사진 조회 완료`);

        if (photos.length === 0) {
          console.log(chalk.yellow('해당 그룹에 사진이 없습니다.'));
          return;
        }

        selectedGroupTitle = photos[0].groupTitle;

        if (options.auto) {
          const validPhotos = photos.filter(p => p.imageUrl);
          selectedPhotos = validPhotos.slice(0, parseInt(options.count));
          console.log(chalk.green(`✓ 그룹 [${selectedGroupTitle}] 최신 ${selectedPhotos.length}개 사진 선택됨`));
        } else {
          const choices = photos.map((p, i) => ({
            name: p.title,
            value: p,
            checked: i < 5
          }));

          const photoAnswer = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'photos',
              message: `[${selectedGroupTitle}] 영상에 포함할 사진 선택:`,
              choices,
              pageSize: 15,
              validate: (arr) => arr.length > 0 || '최소 1개 선택'
            }
          ]);
          selectedPhotos = photoAnswer.photos;
        }
      } else {
        // 대화형 모드: 그룹 선택 → 사진 선택
        if (!options.auto) {
          // 그룹 목록 조회
          const groupSpinner = ora('그룹 목록 조회 중...').start();
          const groups = await fetchGroups({ limit: 20 });
          groupSpinner.succeed();

          let selectedGroupId = null;

          if (groups.length > 0) {
            const groupChoices = [
              { name: '📸 전체 사진 (그룹 무관)', value: null },
              ...groups.map(g => ({
                name: `📁 ${g.title}`,
                value: g.id
              }))
            ];

            const { group } = await inquirer.prompt([
              {
                type: 'list',
                name: 'group',
                message: '영상에 사용할 그룹 선택:',
                choices: groupChoices,
                pageSize: 10
              }
            ]);
            selectedGroupId = group;

            if (selectedGroupId) {
              const groupInfo = groups.find(g => g.id === selectedGroupId);
              selectedGroupTitle = groupInfo?.title;
            }
          }

          // 선택된 그룹의 사진 조회
          const photoSpinner = ora('사진 조회 중...').start();
          const photos = selectedGroupId
            ? await fetchPhotosByGroup(selectedGroupId, { limit: 50, sort: options.sort })
            : await fetchPhotos({ limit: 50, sort: options.sort });
          photoSpinner.succeed();

          if (photos.length === 0) {
            console.log(chalk.yellow('사진이 없습니다. 먼저 Field Uploader로 업로드하세요.'));
            return;
          }

          const choices = photos.map((p, i) => ({
            name: p.groupTitle
              ? `[${p.groupTitle}] ${p.title}`
              : p.title,
            value: p,
            checked: i < 5
          }));

          const photoAnswer = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'photos',
              message: '영상에 포함할 사진 선택:',
              choices,
              pageSize: 15,
              validate: (arr) => arr.length > 0 || '최소 1개 선택'
            }
          ]);
          selectedPhotos = photoAnswer.photos;

          // BGM 선택 (대화형)
          if (!options.bgm) {
            const bgmDir = join(__dirname, '../assets/bgm');
            const bgmFiles = existsSync(bgmDir)
              ? readdirSync(bgmDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
              : [];

            if (bgmFiles.length > 0) {
              const bgmChoices = [
                { name: 'BGM 없음', value: null },
                ...bgmFiles.map(f => ({ name: f, value: join(bgmDir, f) }))
              ];

              const bgmAnswer = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'bgm',
                  message: '🎵 BGM 선택:',
                  choices: bgmChoices
                }
              ]);
              options.bgm = bgmAnswer.bgm;
            }
          }
        } else {
          // 자동 모드 (그룹 미지정)
          const spinner = ora('사진 조회 중...').start();
          const photos = await fetchPhotos({ limit: 50, sort: options.sort });
          spinner.succeed();

          if (photos.length === 0) {
            console.log(chalk.yellow('사진이 없습니다. 먼저 Field Uploader로 업로드하세요.'));
            return;
          }

          const validPhotos = photos.filter(p => p.imageUrl);
          selectedPhotos = validPhotos.slice(0, parseInt(options.count));
          console.log(chalk.green(`✓ 최신 ${selectedPhotos.length}개 사진 선택됨 (이미지 있음)`));
        }
      }

      if (!selectedPhotos || selectedPhotos.length === 0) {
        console.log(chalk.yellow('선택된 사진이 없습니다.'));
        return;
      }

      // 자동 모드에서 BGM 적용 (랜덤 또는 기본)
      if (!options.bgm) {
        const bgmDir = join(__dirname, '../assets/bgm');
        const bgmFiles = existsSync(bgmDir)
          ? readdirSync(bgmDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
          : [];

        if (config.audio?.randomBgm && bgmFiles.length > 0) {
          // 랜덤 BGM 선택
          const randomBgm = bgmFiles[Math.floor(Math.random() * bgmFiles.length)];
          options.bgm = join(bgmDir, randomBgm);
          console.log(chalk.dim(`🎵 랜덤 BGM: ${randomBgm}`));
        } else if (config.audio?.defaultBgm) {
          // 기본 BGM 적용
          const defaultBgmPath = join(bgmDir, config.audio.defaultBgm);
          if (existsSync(defaultBgmPath)) {
            options.bgm = defaultBgmPath;
            console.log(chalk.dim(`🎵 기본 BGM: ${config.audio.defaultBgm}`));
          }
        }
      }

      // 이미지 다운로드
      const downloadSpinner = ora('이미지 다운로드 중...').start();

      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        photo.localPath = await downloadImage(photo, tempDir);
        downloadSpinner.text = `이미지 다운로드 중... (${i + 1}/${selectedPhotos.length})`;
      }
      downloadSpinner.succeed('이미지 다운로드 완료');

      // AI 자막 생성 (옵션 활성화 시)
      if (options.aiSubtitle) {
        const aiCheck = checkAvailability();
        if (!aiCheck.available) {
          console.log(chalk.yellow(`\n⚠️  AI 자막 사용 불가: ${aiCheck.reason}`));
          console.log(chalk.dim('환경변수 설정: set GOOGLE_API_KEY=your-api-key'));
        } else {
          // 품질 레벨 검증
          const quality = options.aiQuality || 'balanced';
          if (!QUALITY_LEVELS.includes(quality)) {
            console.log(chalk.yellow(`⚠️  알 수 없는 품질 레벨: ${quality}`));
            console.log(chalk.dim(`사용 가능: ${QUALITY_LEVELS.join(', ')}`));
            return;
          }

          const qualityLabel = {
            creative: '🎨 창의적',
            balanced: '⚖️ 균형',
            conservative: '🛡️ 보수적'
          }[quality];

          const aiSpinner = ora(`🤖 AI 자막 생성 중... (${qualityLabel})`).start();
          try {
            selectedPhotos = await generateSubtitles(selectedPhotos, {
              promptTemplate: options.promptTemplate || 'default',
              quality,
              readingSpeed: options.readingSpeed || 'normal',
              onProgress: (msg) => {
                aiSpinner.text = `🤖 AI 자막 생성 중... ${msg}`;
              }
            });
            aiSpinner.succeed(`AI 자막 생성 완료 (${qualityLabel})`);

            // 생성된 자막 미리보기
            console.log(chalk.dim('\n📝 생성된 자막:'));
            selectedPhotos.forEach((p, i) => {
              const duration = p.dynamicDuration ? `${p.dynamicDuration}초` : '';
              console.log(chalk.dim(`  [${i + 1}] "${p.finalSubtitle}" ${duration}`));
            });
            console.log('');

            // AI 자막 리뷰 (--ai-review 옵션)
            if (options.aiReview) {
              const reviewAnswer = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'editSubtitles',
                  message: '자막을 수정하시겠습니까?',
                  default: false
                }
              ]);

              if (reviewAnswer.editSubtitles) {
                for (let i = 0; i < selectedPhotos.length; i++) {
                  const photo = selectedPhotos[i];
                  const editAnswer = await inquirer.prompt([
                    {
                      type: 'input',
                      name: 'subtitle',
                      message: `[${i + 1}/${selectedPhotos.length}] 자막:`,
                      default: photo.finalSubtitle
                    }
                  ]);
                  photo.finalSubtitle = editAnswer.subtitle;
                }
                console.log(chalk.green('✓ 자막 수정 완료'));
              }
            }
          } catch (aiErr) {
            aiSpinner.fail('AI 자막 생성 실패: ' + aiErr.message);
            console.log(chalk.dim('기본 자막(그룹명)으로 진행합니다.'));
          }
        }
      }

      // 무작위 duration 적용 (randomDuration 설정이 활성화된 경우)
      const randomDurationConfig = config.randomDuration || {};
      if (randomDurationConfig.enabled && !options.beatSync) {
        const min = randomDurationConfig.min || 5;
        const max = randomDurationConfig.max || 10;
        selectedPhotos.forEach(photo => {
          // AI 동적 duration이 없는 경우에만 무작위 적용
          if (!photo.dynamicDuration) {
            photo.dynamicDuration = Math.floor(Math.random() * (max - min + 1)) + min;
          }
        });
        console.log(chalk.cyan(`⏱️  무작위 재생시간 적용: ${min}~${max}초`));
        selectedPhotos.forEach((p, i) => {
          console.log(chalk.dim(`  [${i + 1}] ${p.title}: ${p.dynamicDuration}초`));
        });
      }

      // BGM 비트 동기화 적용 (--beat-sync 옵션)
      if (options.beatSync) {
        try {
          // BPM 파싱 (프리셋 또는 숫자)
          const bpmInput = isNaN(options.beatSync) ? options.beatSync : parseInt(options.beatSync);

          selectedPhotos = applyBeatSync(selectedPhotos, {
            bpm: bpmInput,
            baseDuration: videoConfig.video?.photoDuration || 3
          });

          const summary = getBeatSyncSummary(selectedPhotos, videoConfig.video?.transitionDuration || 0.5);
          if (summary) {
            const presetInfo = BPM_PRESETS[options.beatSync];
            const bpmLabel = presetInfo ? `${presetInfo.name} (${summary.bpm} BPM)` : `${summary.bpm} BPM`;
            console.log(chalk.cyan(`🎵 비트 동기화: ${bpmLabel}`));
            console.log(chalk.dim(`   비트 간격: ${summary.beatInterval}초, 총 ${summary.totalBeats}비트`));
            selectedPhotos.forEach((p, i) => {
              console.log(chalk.dim(`  [${i + 1}] ${p.title}: ${p.dynamicDuration?.toFixed(2)}초 (${p.beatSyncInfo?.beats}비트)`));
            });
          }
        } catch (beatErr) {
          console.log(chalk.yellow(`⚠️  비트 동기화 실패: ${beatErr.message}`));
          console.log(chalk.dim('기본 재생시간으로 진행합니다.'));
        }
      }

      // 출력 경로 결정
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let filename = `shorts_${timestamp}.mp4`;

      // 그룹명이 있으면 파일명에 포함
      const groupName = selectedGroupTitle || (selectedPhotos[0]?.groupTitle);
      if (groupName) {
        const safeName = groupName
          .replace(/[\\/:*?"<>|]/g, '_')
          .substring(0, 30);
        filename = `shorts_${safeName}_${timestamp}.mp4`;
      }

      const outputPath = options.output ||
        join(__dirname, '..', config.output.directory, filename);

      // 로고 경로 결정
      let logoPath = null;
      if (options.logo !== false) {
        logoPath = options.logo || join(__dirname, '..', config.branding.logo);
      }

      // 템플릿 적용
      let videoConfig = config;
      if (options.template) {
        if (!TEMPLATES[options.template]) {
          console.log(chalk.yellow(`⚠️  알 수 없는 템플릿: ${options.template}`));
          console.log(chalk.dim(`사용 가능: ${getTemplateNames().join(', ')}`));
          return;
        }
        videoConfig = applyTemplate(config, options.template);
        console.log(chalk.cyan(`🎨 템플릿 적용: ${TEMPLATES[options.template].name}`));
      }

      // CLI 옵션으로 전환 효과 오버라이드
      if (options.transition && options.transition !== 'directionalwipe') {
        videoConfig.video.transition = options.transition;
      }

      // CLI 옵션으로 Ken Burns 모드 오버라이드
      if (options.kenBurnsMode) {
        videoConfig.template = videoConfig.template || {};
        videoConfig.template.kenBurnsMode = options.kenBurnsMode;
      }

      // 인트로/아웃트로 설정
      if (options.intro) {
        videoConfig.intro = {
          enabled: true,
          text: options.intro,
          preset: options.introPreset || 'simple'
        };
        console.log(chalk.cyan(`🎬 인트로: "${options.intro}" (${options.introPreset || 'simple'})`));
      }

      if (options.outro) {
        videoConfig.outro = {
          enabled: true,
          text: options.outro,
          subText: options.outroSub,
          preset: options.outroPreset || 'cta'
        };
        console.log(chalk.cyan(`🎬 아웃트로: "${options.outro}" (${options.outroPreset || 'cta'})`));
      }

      // 미리보기 모드 또는 일반 영상 생성
      if (options.preview) {
        const previewQuality = options.previewQuality || 'fast';
        const previewPreset = PREVIEW_PRESETS[previewQuality] || PREVIEW_PRESETS.fast;
        const estimatedTime = estimatePreviewTime(selectedPhotos.length, previewQuality);

        const previewSpinner = ora(`🎬 미리보기 생성 중... (${previewPreset.name}, ${estimatedTime})`).start();

        try {
          const previewPath = outputPath.replace('.mp4', '_preview.mp4');
          await generatePreview(selectedPhotos, {
            outputPath: previewPath,
            config: videoConfig,
            quality: previewQuality
          });
          previewSpinner.succeed(chalk.green('✅ 미리보기 생성 완료!'));
          console.log(`\n📁 미리보기: ${chalk.cyan(previewPath)}`);
          console.log(`📐 해상도: ${previewPreset.width}x${previewPreset.height}`);
          console.log(`⏱️  총 길이: ~${selectedPhotos.length * videoConfig.video.photoDuration}초`);
          console.log(chalk.dim('💡 미리보기 확인 후 --preview 없이 실행하면 고해상도 영상 생성'));
        } catch (previewErr) {
          previewSpinner.fail('미리보기 생성 실패');
          console.error(chalk.red('\n오류 상세:'), previewErr.message);
        }
      } else {
        // 일반 영상 생성
        const genSpinner = ora('🎬 영상 생성 중... (FFmpeg filter_complex)').start();

        try {
          await generateVideo(selectedPhotos, {
            outputPath,
            bgmPath: options.bgm,
            logoPath,
            config: videoConfig
          });
          genSpinner.succeed(chalk.green(`✅ 영상 생성 완료!`));
          console.log(`\n📁 출력 파일: ${chalk.cyan(outputPath)}`);
          console.log(`📐 해상도: ${videoConfig.video.width}x${videoConfig.video.height}`);

          // 동적 duration이 있으면 실제 합계, 없으면 고정값 계산
          const totalDuration = selectedPhotos.reduce((sum, p) => {
            return sum + (p.dynamicDuration || videoConfig.video.photoDuration);
          }, 0);
          console.log(`⏱️  총 길이: ~${Math.round(totalDuration)}초`);

          if (options.template) {
            console.log(`🎨 템플릿: ${TEMPLATES[options.template].name}`);
          }
          if (options.aiSubtitle) {
            console.log(`🤖 AI 자막: 활성화`);
          }

          // 썸네일 생성
          if (options.thumbnail) {
            const thumbSpinner = ora('🖼️  썸네일 생성 중...').start();
            try {
              const position = isNaN(options.thumbnailPos) ? options.thumbnailPos : parseFloat(options.thumbnailPos);
              const thumbOptions = {
                position,
                width: config.video.width,
                height: config.video.height,
                text: options.thumbnailText,
                textStyle: options.thumbnailStyle || 'default'
              };

              let thumbPath;
              if (options.thumbnailBest) {
                // 최적 프레임 자동 선택
                thumbSpinner.text = '🖼️  최적 썸네일 선택 중... (5개 후보 분석)';
                thumbPath = await generateBestThumbnail(outputPath, null, thumbOptions);
              } else {
                thumbPath = await generateThumbnail(outputPath, null, thumbOptions);
              }

              thumbSpinner.succeed(chalk.green('✅ 썸네일 생성 완료!'));
              console.log(`🖼️  썸네일: ${chalk.cyan(thumbPath)}`);
              if (options.thumbnailText) {
                console.log(`📝 텍스트: "${options.thumbnailText}" (${options.thumbnailStyle || 'default'})`);
              }
              if (options.thumbnailBest) {
                console.log(chalk.dim('🔍 최적 프레임 자동 선택됨'));
              }
            } catch (thumbErr) {
              thumbSpinner.fail('썸네일 생성 실패: ' + thumbErr.message);
            }
          }
        } catch (genErr) {
          genSpinner.fail('영상 생성 실패');
          console.error(chalk.red('\n오류 상세:'), genErr.message);
          console.log(chalk.dim('\nFFmpeg가 설치되어 있는지 확인하세요: ffmpeg -version'));
        }
      }

    } catch (err) {
      console.error(chalk.red('오류:'), err.message);
      console.error(chalk.dim(err.stack));
    }
  });

// Thumbnail command
program
  .command('thumbnail <video>')
  .description('기존 영상에서 썸네일 생성')
  .option('-o, --output <path>', '출력 경로')
  .option('-p, --position <pos>', '위치 (start/middle/end 또는 초)', 'middle')
  .option('-t, --text <text>', '텍스트 오버레이')
  .option('-s, --style <style>', '텍스트 스타일 (default/banner/centered/minimal)', 'default')
  .option('-b, --best', '최적 프레임 자동 선택')
  .action(async (videoPath, options) => {
    const spinner = ora('🖼️  썸네일 생성 중...').start();
    try {
      if (!existsSync(videoPath)) {
        spinner.fail(`파일을 찾을 수 없습니다: ${videoPath}`);
        return;
      }

      const position = isNaN(options.position) ? options.position : parseFloat(options.position);
      const thumbOptions = {
        position,
        width: config.video.width,
        height: config.video.height,
        text: options.text,
        textStyle: options.style || 'default'
      };

      let thumbPath;
      if (options.best) {
        spinner.text = '🖼️  최적 썸네일 선택 중... (5개 후보 분석)';
        thumbPath = await generateBestThumbnail(videoPath, options.output, thumbOptions);
      } else {
        thumbPath = await generateThumbnail(videoPath, options.output, thumbOptions);
      }

      spinner.succeed(chalk.green('✅ 썸네일 생성 완료!'));
      console.log(`\n🖼️  출력 파일: ${chalk.cyan(thumbPath)}`);
      console.log(`📐 해상도: ${config.video.width}x${config.video.height}`);
      if (!options.best) {
        console.log(`📍 위치: ${options.position}`);
      }
      if (options.text) {
        console.log(`📝 텍스트: "${options.text}" (${options.style || 'default'})`);
      }
      if (options.best) {
        console.log(chalk.dim('🔍 최적 프레임 자동 선택됨'));
      }
    } catch (err) {
      spinner.fail('썸네일 생성 실패: ' + err.message);
      console.error(chalk.dim(err.stack));
    }
  });

// Templates command
program
  .command('templates')
  .description('사용 가능한 템플릿 목록')
  .option('-d, --detail', '상세 정보 표시')
  .action((options) => {
    console.log(chalk.bold('\n🎨 사용 가능한 템플릿:\n'));

    const templates = getTemplateList();
    templates.forEach(t => {
      console.log(`  ${chalk.cyan(t.name.padEnd(16))} ${chalk.white(t.displayName)} - ${chalk.dim(t.description)}`);

      if (options.detail) {
        const template = TEMPLATES[t.name];
        console.log(chalk.dim(`                  • 사진 ${template.photoDuration}초, ${template.transition} 전환`));
        console.log(chalk.dim(`                  • Ken Burns: ${template.kenBurns ? '활성' : '비활성'}, 자막: ${template.subtitlePosition}`));
        console.log('');
      }
    });

    console.log('\n' + chalk.bold('사용법:'));
    console.log(chalk.dim('  node src/index.js create --auto --template dynamic'));
    console.log(chalk.dim('  node src/index.js create --auto -t elegant'));
  });

// Config command
program
  .command('config')
  .description('현재 설정 표시')
  .action(() => {
    console.log(chalk.bold('\n⚙️  현재 설정:'));
    console.log(chalk.dim(JSON.stringify(config, null, 2)));
    console.log('\n' + chalk.bold('🎞️  사용 가능한 전환 효과:'));
    TRANSITIONS.forEach(t => console.log(`  - ${t}`));
  });

program.parse();
