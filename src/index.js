#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fetchPhotos, downloadImage } from './api/pocketbase.js';
import { generateVideo, TRANSITIONS } from './video/generator.js';
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

// List command
program
  .command('list')
  .description('PocketBase에서 사진 목록 조회')
  .option('-n, --limit <number>', '조회할 개수', '20')
  .option('--since <date>', '특정 날짜 이후 (YYYY-MM-DD)')
  .action(async (options) => {
    const spinner = ora('사진 목록 조회 중...').start();
    try {
      const photos = await fetchPhotos({
        limit: parseInt(options.limit),
        since: options.since
      });
      spinner.succeed(`${photos.length}개 사진 조회 완료`);

      if (photos.length === 0) {
        console.log(chalk.yellow('\n사진이 없습니다.'));
        return;
      }

      console.log('\n' + chalk.bold('📸 최근 사진 목록:'));
      photos.forEach((photo, i) => {
        const date = new Date(photo.created).toLocaleString('ko-KR');
        console.log(`  ${chalk.gray(`[${i + 1}]`)} ${chalk.white(photo.title)} ${chalk.dim(`(${date})`)}`);
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
  .option('-o, --output <path>', '출력 경로')
  .option('--bgm <path>', 'BGM 파일 경로')
  .option('--logo <path>', '로고 이미지 경로')
  .option('--no-logo', '로고 비활성화')
  .option('--transition <name>', '전환 효과', 'directionalwipe')
  .option('--ids <ids>', '사진 ID 목록 (쉼표 구분)')
  .action(async (options) => {
    try {
      let selectedPhotos;

      if (options.ids) {
        // ID로 직접 지정
        const ids = options.ids.split(',').map(id => id.trim());
        const spinner = ora('사진 조회 중...').start();
        const allPhotos = await fetchPhotos({ limit: 100 });
        selectedPhotos = allPhotos.filter(p => ids.includes(p.id));
        spinner.succeed(`${selectedPhotos.length}개 사진 선택됨`);
      } else {
        // 사진 조회
        const spinner = ora('사진 조회 중...').start();
        const photos = await fetchPhotos({ limit: 50 });
        spinner.succeed();

        if (photos.length === 0) {
          console.log(chalk.yellow('사진이 없습니다. 먼저 Field Uploader로 업로드하세요.'));
          return;
        }

        if (options.auto) {
          // 자동 모드: 최신 N개
          selectedPhotos = photos.slice(0, parseInt(options.count));
          console.log(chalk.green(`✓ 최신 ${selectedPhotos.length}개 사진 선택됨`));
        } else {
          // 대화형 모드
          const choices = photos.map((p, i) => ({
            name: `${p.title} (${new Date(p.created).toLocaleDateString('ko-KR')})`,
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
        }
      }

      if (!selectedPhotos || selectedPhotos.length === 0) {
        console.log(chalk.yellow('선택된 사진이 없습니다.'));
        return;
      }

      // 이미지 다운로드
      const downloadSpinner = ora('이미지 다운로드 중...').start();

      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        photo.localPath = await downloadImage(photo, tempDir);
        downloadSpinner.text = `이미지 다운로드 중... (${i + 1}/${selectedPhotos.length})`;
      }
      downloadSpinner.succeed('이미지 다운로드 완료');

      // 출력 경로 결정
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outputPath = options.output ||
        join(__dirname, '..', config.output.directory, `shorts_${timestamp}.mp4`);

      // 영상 생성
      const genSpinner = ora('🎬 영상 생성 중... (FFmpeg 실행)').start();

      try {
        await generateVideo(selectedPhotos, {
          outputPath,
          bgmPath: options.bgm,
          logoPath: options.logo === false ? null : options.logo,
          config: {
            ...config,
            video: {
              ...config.video,
              transition: options.transition
            }
          }
        });
        genSpinner.succeed(chalk.green(`✅ 영상 생성 완료!`));
        console.log(`\n📁 출력 파일: ${chalk.cyan(outputPath)}`);
        console.log(`📐 해상도: ${config.video.width}x${config.video.height}`);
        console.log(`⏱️  총 길이: ~${selectedPhotos.length * config.video.photoDuration}초`);
      } catch (genErr) {
        genSpinner.fail('영상 생성 실패');
        console.error(chalk.red('\n오류 상세:'), genErr.message);
        console.log(chalk.dim('\nFFmpeg가 설치되어 있는지 확인하세요: ffmpeg -version'));
      }

    } catch (err) {
      console.error(chalk.red('오류:'), err.message);
      console.error(chalk.dim(err.stack));
    }
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
