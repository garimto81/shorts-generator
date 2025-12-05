#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fetchPhotos, downloadImage } from './api/pocketbase.js';
import { generateVideo } from './video/generator.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../config.json'), 'utf-8'));

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
  .action(async (options) => {
    const spinner = ora('사진 목록 조회 중...').start();
    try {
      const photos = await fetchPhotos({ limit: parseInt(options.limit) });
      spinner.succeed(`${photos.length}개 사진 조회 완료`);

      console.log('\n' + chalk.bold('📸 최근 사진 목록:'));
      photos.forEach((photo, i) => {
        const date = new Date(photo.created).toLocaleString('ko-KR');
        console.log(`  ${chalk.gray(`[${i + 1}]`)} ${photo.title} ${chalk.dim(`(${date})`)}`);
      });
    } catch (err) {
      spinner.fail('조회 실패: ' + err.message);
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
  .action(async (options) => {
    try {
      // 사진 조회
      const spinner = ora('사진 조회 중...').start();
      const photos = await fetchPhotos({ limit: 50 });
      spinner.succeed();

      let selectedPhotos;

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

        const answers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'photos',
            message: '영상에 포함할 사진 선택:',
            choices,
            validate: (arr) => arr.length > 0 || '최소 1개 선택'
          }
        ]);
        selectedPhotos = answers.photos;
      }

      // 이미지 다운로드
      const downloadSpinner = ora('이미지 다운로드 중...').start();
      const tempDir = join(__dirname, '../temp');

      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        photo.localPath = await downloadImage(photo, tempDir);
        downloadSpinner.text = `이미지 다운로드 중... (${i + 1}/${selectedPhotos.length})`;
      }
      downloadSpinner.succeed('이미지 다운로드 완료');

      // 영상 생성
      const outputPath = options.output ||
        join(config.output.directory, `shorts_${Date.now()}.mp4`);

      const genSpinner = ora('영상 생성 중...').start();
      await generateVideo(selectedPhotos, {
        outputPath,
        bgmPath: options.bgm,
        config
      });
      genSpinner.succeed(`영상 생성 완료: ${outputPath}`);

    } catch (err) {
      console.error(chalk.red('오류:'), err.message);
    }
  });

program.parse();
