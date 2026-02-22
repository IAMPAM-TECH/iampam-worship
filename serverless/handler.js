const express = require('express');
const serverless = require('serverless-http');
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS 설정
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://worship.iampam.io',
    'https://biblecontents.iampam.io',
    'https://hishalom-frontend.s3.ap-northeast-2.amazonaws.com',
    'https://hishalom-frontend.s3-website.ap-northeast-2.amazonaws.com',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://localhost:8080'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://worship.iampam.io');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, expires, cache-control, pragma, if-modified-since, if-none-match');
  res.header('Access-Control-Allow-Credentials', true);
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// AWS 클라이언트 초기화
const s3Client = new S3Client({ region: 'ap-northeast-2' });
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const transcribeClient = new TranscribeClient({ region: 'ap-northeast-2' });

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'hishalom-data';
const DYNAMODB_TABLE = process.env.STAGE === 'prod' ? 'worship-prod' : 'worship-dev';

// 기본 교회 정보 초기화 함수
async function initializeDefaultChurches() {
  try {
    // 기본 교회 정보 확인
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'CHURCH#hishalom'
      }
    });
    
    const result = await docClient.send(scanCommand);
    
    // 기본 교회가 없으면 생성
    if (result.Items.length === 0) {
      const putCommand = new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: {
          pk: 'CHURCH#hishalom',
          sk: 'INFO',
          churchName: 'hishalom',
          adminPassword: 'hishalom',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      
      await docClient.send(putCommand);
      console.log('기본 교회 정보가 초기화되었습니다: hishalom');
    }
  } catch (error) {
    console.error('기본 교회 정보 초기화 오류:', error);
  }
}

// 서버 시작 시 기본 교회 정보 초기화
initializeDefaultChurches();

// 교회별 로그인 API
app.post('/api/admin-login', async (req, res) => {
  try {
    const { username, id, password, folder } = req.body;
    
    // username 또는 id 중 하나는 있어야 함
    const userId = username || id;
    
    if (!userId || !password || !folder) {
      return res.status(400).json({ error: '모든 필드가 필요합니다.' });
    }
    
    // DynamoDB에서 교회 정보 조회
    const getCommand = new GetCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        pk: `CHURCH#${folder}`,
        sk: 'INFO'
      }
    });
    
    const result = await docClient.send(getCommand);
    
    if (!result.Item) {
      return res.status(401).json({ error: '교회 정보를 찾을 수 없습니다.' });
    }
    
    const churchInfo = result.Item;
    
    // 사용자명 확인 (admin 또는 교회명 허용)
    if (userId !== 'admin' && userId !== churchInfo.churchName) {
      return res.status(401).json({ error: '사용자명이 올바르지 않습니다.' });
    }
    
    // 비밀번호 확인
    if (password !== churchInfo.adminPassword) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }
    
    res.json({ 
      success: true, 
      message: '로그인 성공',
      churchName: churchInfo.churchName
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// 교회 목록 조회 API
app.get('/api/churches', async (req, res) => {
  try {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'begins_with(pk, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CHURCH#'
      }
    });
    
    const result = await docClient.send(scanCommand);
    const churches = result.Items.map(item => ({
      name: item.churchName,
      folder: item.churchName
    }));
    
    res.json(churches);
  } catch (error) {
    console.error('교회 목록 조회 오류:', error);
    res.status(500).json({ error: '교회 목록을 불러올 수 없습니다.' });
  }
});

// 교회 추가 API
app.post('/api/churches', async (req, res) => {
  try {
    const { churchName, adminPassword } = req.body;
    
    if (!churchName || !adminPassword) {
      return res.status(400).json({ error: '교회명과 비밀번호가 필요합니다.' });
    }
    
    const putCommand = new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        pk: `CHURCH#${churchName}`,
        sk: 'INFO',
        churchName: churchName,
        adminPassword: adminPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    
    await docClient.send(putCommand);
    res.json({ message: '교회가 성공적으로 추가되었습니다.' });
  } catch (error) {
    console.error('교회 추가 오류:', error);
    res.status(500).json({ error: '교회 추가에 실패했습니다.' });
  }
});

// 교회 비밀번호 변경 API
app.put('/api/churches/:churchName/password', async (req, res) => {
  try {
    const { churchName } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: '새 비밀번호가 필요합니다.' });
    }
    
    const updateCommand = new UpdateCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        pk: `CHURCH#${churchName}`,
        sk: 'INFO'
      },
      UpdateExpression: 'SET adminPassword = :password, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':password': newPassword,
        ':updatedAt': new Date().toISOString()
      }
    });
    
    await docClient.send(updateCommand);
    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

// 예배 데이터 조회 API
app.get('/api/worship', async (req, res) => {
  try {
    const { folder } = req.query;
    
    if (!folder) {
      return res.status(400).json({ error: '폴더명이 필요합니다.' });
    }
    
    // S3에서 예배 데이터 조회
    try {
      const s3Key = `예배/${folder}/worship.json`;
      const s3Command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: s3Key
      });
      
      const s3Result = await s3Client.send(s3Command);
      const s3Data = await s3Result.Body.transformToString();
      const worshipData = JSON.parse(s3Data);
      
      res.json(worshipData);
    } catch (s3Error) {
      console.log('S3에서 데이터를 찾을 수 없음, 기본 구조 반환');
      // S3에 없으면 기본 구조 반환
      res.json({
        Date: new Date().toISOString().split('T')[0],
        Worship: []
      });
    }
  } catch (error) {
    console.error('예배 데이터 조회 오류:', error);
    res.status(500).json({ error: '예배 데이터를 불러올 수 없습니다.' });
  }
});

// 예배 데이터 저장 API
app.post('/api/worship', async (req, res) => {
  try {
    const { folder, ...worshipData } = req.body;
    
    if (!folder) {
      return res.status(400).json({ error: '폴더명이 필요합니다.' });
    }
    
    // S3에 예배 데이터 저장
    const s3Key = `예배/${folder}/worship.json`;
    const s3Command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(worshipData, null, 2),
      ContentType: 'application/json'
    });
    
    await s3Client.send(s3Command);
    
    res.json({ message: '예배 데이터가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('예배 데이터 저장 오류:', error);
    res.status(500).json({ error: '예배 데이터 저장에 실패했습니다.' });
  }
});



// 소스 데이터 API
app.get('/api/sources/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    // 모든 카테고리는 sources 폴더 없이 바로 폴더들이 있는 구조
    const prefix = `${category}/`;
    
    console.log(`소스 데이터 조회: ${category}, prefix: ${prefix}`);
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix,
      Delimiter: '/'
    });
    
    const data = await s3Client.send(command);
    
    console.log(`${category} S3 응답:`, {
      CommonPrefixes: data.CommonPrefixes?.length || 0,
      Contents: data.Contents?.length || 0,
      IsTruncated: data.IsTruncated
    });
    
    let folders = [];
    
    // CommonPrefixes가 있으면 폴더 구조
    if (data.CommonPrefixes && data.CommonPrefixes.length > 0) {
      folders = data.CommonPrefixes.map(prefix => {
        let name = prefix.Prefix.replace(prefix, '').replace('/', '');
        // 유형값이 앞에 붙어있는 경우 제거
        if (name.startsWith(category)) {
          name = name.replace(new RegExp(`^${category}\\s*`), '');
        }
        return {
          name: name,
          path: prefix.Prefix
        };
      });
    } 
    // Contents가 있으면 파일 구조 (간지, 자료의 경우)
    else if (data.Contents && data.Contents.length > 0) {
      // 파일명에서 확장자 제거하여 폴더명으로 사용
      folders = data.Contents
        .filter(item => item.Key !== prefix) // 루트 폴더 제외
        .map(item => {
          let fileName = item.Key.replace(prefix, '');
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // 확장자 제거
          // 유형값이 앞에 붙어있는 경우 제거
          if (nameWithoutExt.startsWith(category)) {
            fileName = nameWithoutExt.replace(new RegExp(`^${category}\\s*`), '');
          } else {
            fileName = nameWithoutExt;
          }
          return {
            name: fileName,
            path: item.Key
          };
        })
        .filter((item, index, self) => 
          index === self.findIndex(t => t.name === item.name) // 중복 제거
        );
    }
    
    console.log(`${category} 폴더 목록:`, folders);
    
    res.json(folders);
  } catch (error) {
    console.error('소스 데이터 조회 오류:', error);
    res.status(500).json({ error: '소스 데이터를 불러올 수 없습니다.' });
  }
});

// 기존 성경 책 목록 API (S3에서 JSON 파일들 조회) - worship.html용
app.get('/api/bible/books', async (req, res) => {
  try {
    // S3에서 성경 폴더의 모든 JSON 파일 조회
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: '성경/',
      Delimiter: '/'
    });
    
    const data = await s3Client.send(command);
    
    if (!data.Contents) {
      return res.json([]);
    }
    
    // JSON 파일들만 필터링
    const jsonFiles = data.Contents.filter(item => 
      item.Key.endsWith('.json') && 
      item.Key !== '성경/' && 
      item.Key.split('/').length === 2 // 성경/파일명.json 형태만
    );
    
    const books = [];
    
    // 각 JSON 파일에서 책 정보 추출
    for (const file of jsonFiles) {
      try {
        const fileName = file.Key.replace('성경/', '').replace('.json', '');
        
        // JSON 파일 내용 가져오기
        const getCommand = new GetObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: file.Key
        });
        
        const response = await s3Client.send(getCommand);
        const content = await response.Body.transformToString();
        const bookData = JSON.parse(content);
        
        if (bookData.bookInfo) {
          books.push({
            id: bookData.bookInfo.order,
            testament: bookData.bookInfo.testament,
            name: bookData.bookInfo.name,
            abbreviation: bookData.bookInfo.name,
            order_num: bookData.bookInfo.order
          });
        }
      } catch (error) {
        console.warn(`JSON 파일 처리 오류 (${file.Key}):`, error);
        continue;
      }
    }
    
    // order_num으로 정렬
    books.sort((a, b) => a.order_num - b.order_num);
    
    res.json(books);
  } catch (error) {
    console.error('성경 책 목록 조회 오류:', error);
    
    // 오류 시 기본 성경 데이터 반환
    const defaultBooks = [
      // 구약
      { id: 1, testament: "구약", name: "창세기", abbreviation: "창세기", order_num: 1 },
      { id: 2, testament: "구약", name: "출애굽기", abbreviation: "출애굽", order_num: 2 },
      { id: 3, testament: "구약", name: "레위기", abbreviation: "레위기", order_num: 3 },
      { id: 4, testament: "구약", name: "민수기", abbreviation: "민수기", order_num: 4 },
      { id: 5, testament: "구약", name: "신명기", abbreviation: "신명기", order_num: 5 },
      { id: 6, testament: "구약", name: "여호수아", abbreviation: "여호수아", order_num: 6 },
      { id: 7, testament: "구약", name: "사사기", abbreviation: "사사기", order_num: 7 },
      { id: 8, testament: "구약", name: "룻기", abbreviation: "룻기", order_num: 8 },
      { id: 9, testament: "구약", name: "사무엘상", abbreviation: "사무엘상", order_num: 9 },
      { id: 10, testament: "구약", name: "사무엘하", abbreviation: "사무엘하", order_num: 10 },
      { id: 11, testament: "구약", name: "열왕기상", abbreviation: "열왕기상", order_num: 11 },
      { id: 12, testament: "구약", name: "열왕기하", abbreviation: "열왕기하", order_num: 12 },
      { id: 13, testament: "구약", name: "역대상", abbreviation: "역대상", order_num: 13 },
      { id: 14, testament: "구약", name: "역대하", abbreviation: "역대하", order_num: 14 },
      { id: 15, testament: "구약", name: "에스라", abbreviation: "에스라", order_num: 15 },
      { id: 16, testament: "구약", name: "느헤미야", abbreviation: "느헤미야", order_num: 16 },
      { id: 17, testament: "구약", name: "에스더", abbreviation: "에스더", order_num: 17 },
      { id: 18, testament: "구약", name: "욥기", abbreviation: "욥기", order_num: 18 },
      { id: 19, testament: "구약", name: "시편", abbreviation: "시편", order_num: 19 },
      { id: 20, testament: "구약", name: "잠언", abbreviation: "잠언", order_num: 20 },
      { id: 21, testament: "구약", name: "전도서", abbreviation: "전도서", order_num: 21 },
      { id: 22, testament: "구약", name: "아가", abbreviation: "아가", order_num: 22 },
      { id: 23, testament: "구약", name: "이사야", abbreviation: "이사야", order_num: 23 },
      { id: 24, testament: "구약", name: "예레미야", abbreviation: "예레미야", order_num: 24 },
      { id: 25, testament: "구약", name: "예레미야애가", abbreviation: "예레미야애가", order_num: 25 },
      { id: 26, testament: "구약", name: "에스겔", abbreviation: "에스겔", order_num: 26 },
      { id: 27, testament: "구약", name: "다니엘", abbreviation: "다니엘", order_num: 27 },
      { id: 28, testament: "구약", name: "호세아", abbreviation: "호세아", order_num: 28 },
      { id: 29, testament: "구약", name: "요엘", abbreviation: "요엘", order_num: 29 },
      { id: 30, testament: "구약", name: "아모스", abbreviation: "아모스", order_num: 30 },
      { id: 31, testament: "구약", name: "오바댜", abbreviation: "오바댜", order_num: 31 },
      { id: 32, testament: "구약", name: "요나", abbreviation: "요나", order_num: 32 },
      { id: 33, testament: "구약", name: "미가", abbreviation: "미가", order_num: 33 },
      { id: 34, testament: "구약", name: "나훔", abbreviation: "나훔", order_num: 34 },
      { id: 35, testament: "구약", name: "하박국", abbreviation: "하박국", order_num: 35 },
      { id: 36, testament: "구약", name: "스바냐", abbreviation: "스바냐", order_num: 36 },
      { id: 37, testament: "구약", name: "학개", abbreviation: "학개", order_num: 37 },
      { id: 38, testament: "구약", name: "스가랴", abbreviation: "스가랴", order_num: 38 },
      { id: 39, testament: "구약", name: "말라기", abbreviation: "말라기", order_num: 39 },
      // 신약
      { id: 40, testament: "신약", name: "마태복음", abbreviation: "마태", order_num: 40 },
      { id: 41, testament: "신약", name: "마가복음", abbreviation: "마가", order_num: 41 },
      { id: 42, testament: "신약", name: "누가복음", abbreviation: "누가", order_num: 42 },
      { id: 43, testament: "신약", name: "요한복음", abbreviation: "요한", order_num: 43 },
      { id: 44, testament: "신약", name: "사도행전", abbreviation: "행전", order_num: 44 },
      { id: 45, testament: "신약", name: "로마서", abbreviation: "로마", order_num: 45 },
      { id: 46, testament: "신약", name: "고린도전서", abbreviation: "고전", order_num: 46 },
      { id: 47, testament: "신약", name: "고린도후서", abbreviation: "고후", order_num: 47 },
      { id: 48, testament: "신약", name: "갈라디아서", abbreviation: "갈라디아", order_num: 48 },
      { id: 49, testament: "신약", name: "에베소서", abbreviation: "에베소", order_num: 49 },
      { id: 50, testament: "신약", name: "빌립보서", abbreviation: "빌립보", order_num: 50 },
      { id: 51, testament: "신약", name: "골로새서", abbreviation: "골로새", order_num: 51 },
      { id: 52, testament: "신약", name: "데살로니가전서", abbreviation: "살전", order_num: 52 },
      { id: 53, testament: "신약", name: "데살로니가후서", abbreviation: "살후", order_num: 53 },
      { id: 54, testament: "신약", name: "디모데전서", abbreviation: "딤전", order_num: 54 },
      { id: 55, testament: "신약", name: "디모데후서", abbreviation: "딤후", order_num: 55 },
      { id: 56, testament: "신약", name: "디도서", abbreviation: "디도", order_num: 56 },
      { id: 57, testament: "신약", name: "빌레몬서", abbreviation: "빌레몬", order_num: 57 },
      { id: 58, testament: "신약", name: "히브리서", abbreviation: "히브리", order_num: 58 },
      { id: 59, testament: "신약", name: "야고보서", abbreviation: "야고보", order_num: 59 },
      { id: 60, testament: "신약", name: "베드로전서", abbreviation: "벧전", order_num: 60 },
      { id: 61, testament: "신약", name: "베드로후서", abbreviation: "벧후", order_num: 61 },
      { id: 62, testament: "신약", name: "요한일서", abbreviation: "요일", order_num: 62 },
      { id: 63, testament: "신약", name: "요한이서", abbreviation: "요이", order_num: 63 },
      { id: 64, testament: "신약", name: "요한삼서", abbreviation: "요삼", order_num: 64 },
      { id: 65, testament: "신약", name: "유다서", abbreviation: "유다", order_num: 65 },
      { id: 66, testament: "신약", name: "요한계시록", abbreviation: "계시록", order_num: 66 }
    ];
    
    res.json(defaultBooks);
  }
});

// 기존 성경 구절 API (S3에서 JSON 파일 조회) - worship.html용
app.get('/api/bible', async (req, res) => {
  try {
    const { book, chapter, startVerse, endVerse } = req.query;
    
    if (!book || !chapter || !startVerse || !endVerse) {
      return res.status(400).json({ error: '필수 매개변수가 누락되었습니다.' });
    }

    // 단장 책은 1장으로 강제
    const singleChapterBooks = ['요한이서', '요한삼서', '유다서', '오바댜', '빌레몬서'];
    const isSingleChapter = singleChapterBooks.includes(book);
    const effectiveChapter = isSingleChapter ? '1' : chapter;

    // S3에서 해당 책의 JSON 파일 가져오기
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: `성경/${book}.json`
    });
    
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    const bookData = JSON.parse(content);
    
    // 해당 장의 구절들 추출 (단장 책 또는 verses-only 구조 대응)
    let chapterData = bookData.chapters ? bookData.chapters[effectiveChapter] : undefined;

    // 1) chapters가 없고 verses만 있는 단장 구조 (요한이서/요한삼서/유다서 등)
    if (!chapterData && bookData.verses) {
      // 장 정보가 없으므로 1장으로 취급
      if (effectiveChapter && parseInt(effectiveChapter) !== 1) {
        return res.status(404).json({ error: '해당 장을 찾을 수 없습니다.' });
      }
      chapterData = bookData.verses;
    }

    // 2) chapters는 있으나 단장만 존재하는 경우 (키가 하나뿐)
    if (!chapterData && bookData.chapters && Object.keys(bookData.chapters).length === 1) {
      const onlyChapter = Object.keys(bookData.chapters)[0];
      // 요청 장이 없거나 1장이면 단장으로 대응
      if (!chapter || parseInt(effectiveChapter) === 1 || onlyChapter === effectiveChapter) {
        chapterData = bookData.chapters[onlyChapter];
      }
    }

    if (!chapterData) {
      return res.status(404).json({ error: '해당 장을 찾을 수 없습니다.' });
    }
    
    const verses = [];
    for (let verseNum = parseInt(startVerse); verseNum <= parseInt(endVerse); verseNum++) {
      const verseContent = chapterData[verseNum.toString()];
      if (verseContent) {
        verses.push({
          chapter: parseInt(effectiveChapter),
          verse: verseNum,
          content: verseContent
        });
      }
    }
    
    if (verses.length === 0) {
      return res.status(404).json({ error: '해당 성경 구절을 찾을 수 없습니다.' });
    }
    
    res.json(verses);
  } catch (error) {
    console.error('성경 구절 조회 오류:', error);
    res.status(500).json({ error: '성경 구절을 불러올 수 없습니다.' });
  }
});

// Online Bible API - 성경 번역본 정보
const BIBLE_VERSIONS = {
  'kornkrv': { name: '개역개정', lang: 'ko', prefix: 'kornkrv' },
  'koreasy': { name: '쉬운성경', lang: 'ko', prefix: 'koreasy' },
  'korklb': { name: '현대인의성경', lang: 'ko', prefix: 'korklb' },
  'kornrsv': { name: '새번역', lang: 'ko', prefix: 'kornrsv' },
  'ENGKJV': { name: 'KJV', lang: 'en', prefix: 'ENGKJV' },
  'engNIV': { name: 'NIV', lang: 'en', prefix: 'engNIV' }
};

// Online Bible API - 성경책 정보
const BIBLE_BOOKS = {
  '01': { name: '창세기', short: '창', eng: 'Genesis', engShort: 'Gn' },
  '02': { name: '출애굽기', short: '출', eng: 'Exodus', engShort: 'Ex' },
  '03': { name: '레위기', short: '레', eng: 'Leviticus', engShort: 'Lv' },
  '04': { name: '민수기', short: '민', eng: 'Numbers', engShort: 'Nu' },
  '05': { name: '신명기', short: '신', eng: 'Deuteronomy', engShort: 'Dt' },
  '06': { name: '여호수아', short: '수', eng: 'Joshua', engShort: 'Jos' },
  '07': { name: '사사기', short: '삿', eng: 'Judges', engShort: 'Jdg' },
  '08': { name: '룻기', short: '룻', eng: 'Ruth', engShort: 'Ru' },
  '09': { name: '사무엘상', short: '삼상', eng: '1 Samuel', engShort: '1Sa' },
  '10': { name: '사무엘하', short: '삼하', eng: '2 Samuel', engShort: '2Sa' },
  '11': { name: '열왕기상', short: '왕상', eng: '1 Kings', engShort: '1Ki' },
  '12': { name: '열왕기하', short: '왕하', eng: '2 Kings', engShort: '2Ki' },
  '13': { name: '역대상', short: '대상', eng: '1 Chronicles', engShort: '1Ch' },
  '14': { name: '역대하', short: '대하', eng: '2 Chronicles', engShort: '2Ch' },
  '15': { name: '에스라', short: '스', eng: 'Ezra', engShort: 'Ezr' },
  '16': { name: '느헤미야', short: '느', eng: 'Nehemiah', engShort: 'Ne' },
  '17': { name: '에스더', short: '에', eng: 'Esther', engShort: 'Est' },
  '18': { name: '욥기', short: '욥', eng: 'Job', engShort: 'Job' },
  '19': { name: '시편', short: '시', eng: 'Psalms', engShort: 'Ps' },
  '20': { name: '잠언', short: '잠', eng: 'Proverbs', engShort: 'Pr' },
  '21': { name: '전도서', short: '전', eng: 'Ecclesiastes', engShort: 'Ecc' },
  '22': { name: '아가', short: '아', eng: 'Song of Solomon', engShort: 'SoS' },
  '23': { name: '이사야', short: '사', eng: 'Isaiah', engShort: 'Isa' },
  '24': { name: '예레미야', short: '렘', eng: 'Jeremiah', engShort: 'Jer' },
  '25': { name: '예레미야애가', short: '애', eng: 'Lamentations', engShort: 'La' },
  '26': { name: '에스겔', short: '겔', eng: 'Ezekiel', engShort: 'Eze' },
  '27': { name: '다니엘', short: '단', eng: 'Daniel', engShort: 'Da' },
  '28': { name: '호세아', short: '호', eng: 'Hosea', engShort: 'Hos' },
  '29': { name: '요엘', short: '욜', eng: 'Joel', engShort: 'Joe' },
  '30': { name: '아모스', short: '암', eng: 'Amos', engShort: 'Amo' },
  '31': { name: '오바댜', short: '옵', eng: 'Obadiah', engShort: 'Oba' },
  '32': { name: '요나', short: '욘', eng: 'Jonah', engShort: 'Jon' },
  '33': { name: '미가', short: '미', eng: 'Micah', engShort: 'Mic' },
  '34': { name: '나훔', short: '나', eng: 'Nahum', engShort: 'Nah' },
  '35': { name: '하박국', short: '합', eng: 'Habakkuk', engShort: 'Hab' },
  '36': { name: '스바냐', short: '습', eng: 'Zephaniah', engShort: 'Zep' },
  '37': { name: '학개', short: '학', eng: 'Haggai', engShort: 'Hag' },
  '38': { name: '스가랴', short: '슥', eng: 'Zechariah', engShort: 'Zec' },
  '39': { name: '말라기', short: '말', eng: 'Malachi', engShort: 'Mal' },
  '40': { name: '마태복음', short: '마', eng: 'Matthew', engShort: 'Mt' },
  '41': { name: '마가복음', short: '막', eng: 'Mark', engShort: 'Mk' },
  '42': { name: '누가복음', short: '눅', eng: 'Luke', engShort: 'Lk' },
  '43': { name: '요한복음', short: '요', eng: 'John', engShort: 'Jn' },
  '44': { name: '사도행전', short: '행', eng: 'Acts', engShort: 'Ac' },
  '45': { name: '로마서', short: '롬', eng: 'Romans', engShort: 'Ro' },
  '46': { name: '고린도전서', short: '고전', eng: '1 Corinthians', engShort: '1Co' },
  '47': { name: '고린도후서', short: '고후', eng: '2 Corinthians', engShort: '2Co' },
  '48': { name: '갈라디아서', short: '갈', eng: 'Galatians', engShort: 'Gal' },
  '49': { name: '에베소서', short: '엡', eng: 'Ephesians', engShort: 'Eph' },
  '50': { name: '빌립보서', short: '빌', eng: 'Philippians', engShort: 'Php' },
  '51': { name: '골로새서', short: '골', eng: 'Colossians', engShort: 'Col' },
  '52': { name: '데살로니가전서', short: '살전', eng: '1 Thessalonians', engShort: '1Th' },
  '53': { name: '데살로니가후서', short: '살후', eng: '2 Thessalonians', engShort: '2Th' },
  '54': { name: '디모데전서', short: '딤전', eng: '1 Timothy', engShort: '1Ti' },
  '55': { name: '디모데후서', short: '딤후', eng: '2 Timothy', engShort: '2Ti' },
  '56': { name: '디도서', short: '딛', eng: 'Titus', engShort: 'Tit' },
  '57': { name: '빌레몬서', short: '몬', eng: 'Philemon', engShort: 'Phm' },
  '58': { name: '히브리서', short: '히', eng: 'Hebrews', engShort: 'Heb' },
  '59': { name: '야고보서', short: '약', eng: 'James', engShort: 'Jas' },
  '60': { name: '베드로전서', short: '벧전', eng: '1 Peter', engShort: '1Pe' },
  '61': { name: '베드로후서', short: '벧후', eng: '2 Peter', engShort: '2Pe' },
  '62': { name: '요한일서', short: '요일', eng: '1 John', engShort: '1Jn' },
  '63': { name: '요한이서', short: '요이', eng: '2 John', engShort: '2Jn' },
  '64': { name: '요한삼서', short: '요삼', eng: '3 John', engShort: '3Jn' },
  '65': { name: '유다서', short: '유', eng: 'Jude', engShort: 'Jude' },
  '66': { name: '요한계시록', short: '계', eng: 'Revelation', engShort: 'Rev' }
};

// Online Bible API - 성경 번역본 목록 조회
app.get('/api/biblemulti/versions', (req, res) => {
  res.json(BIBLE_VERSIONS);
});

// Online Bible API - 성경책 목록 조회
app.get('/api/biblemulti/books', (req, res) => {
  res.json(BIBLE_BOOKS);
});

// Online Bible API - 특정 성경책의 장 목록 조회
app.get('/api/biblemulti/:version/:book/chapters', async (req, res) => {
  try {
    const { version, book } = req.params;
    
    if (!BIBLE_VERSIONS[version]) {
      return res.status(400).json({ error: 'Invalid version' });
    }
    
    if (!BIBLE_BOOKS[book]) {
      return res.status(400).json({ error: 'Invalid book' });
    }

    const versionDir = getVersionDirName(version);
    const prefix = `성경들/${versionDir}/`;
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix
    });
    
    const data = await s3Client.send(command);
    
    if (!data.Contents) {
      return res.status(404).json({ error: 'Version directory not found' });
    }

    const chapterFiles = data.Contents
      .filter(item => {
        const fileName = item.Key.replace(prefix, '');
        return fileName.startsWith(`${BIBLE_VERSIONS[version].prefix}${book}_`) && fileName.endsWith('.txt');
      })
      .map(item => {
        const fileName = item.Key.replace(prefix, '');
        const chapter = fileName.split('_')[1].replace('.txt', '');
        return parseInt(chapter);
      })
      .sort((a, b) => a - b);

    res.json({ chapters: chapterFiles });
  } catch (err) {
    console.error('장 목록 조회 오류:', err);
    res.status(500).json({ error: 'Failed to read chapters' });
  }
});

// Online Bible API - 특정 장의 성경 구절 조회
app.get('/api/biblemulti/:version/:book/:chapter', async (req, res) => {
  try {
    const { version, book, chapter } = req.params;
    
    if (!BIBLE_VERSIONS[version]) {
      return res.status(400).json({ error: 'Invalid version' });
    }
    
    if (!BIBLE_BOOKS[book]) {
      return res.status(400).json({ error: 'Invalid book' });
    }

    const versionDir = getVersionDirName(version);
    const fileName = `${BIBLE_VERSIONS[version].prefix}${book}_${chapter}.txt`;
    const filePath = `성경들/${versionDir}/${fileName}`;

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filePath
    });
    
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    const verses = parseVerses(content, version, book);
    
    res.json({
      version: BIBLE_VERSIONS[version].name,
      book: BIBLE_BOOKS[book],
      chapter: parseInt(chapter),
      verses: verses
    });
  } catch (err) {
    console.error('장 내용 조회 오류:', err);
    res.status(500).json({ error: 'Failed to read chapter' });
  }
});

// Online Bible API - 특정 장의 절 범위 조회
app.get('/api/biblemulti/:version/:book/:chapter/verses', async (req, res) => {
  try {
    const { version, book, chapter } = req.params;
    const { startVerse, endVerse } = req.query;
    
    if (!BIBLE_VERSIONS[version]) {
      return res.status(400).json({ error: 'Invalid version' });
    }
    
    if (!BIBLE_BOOKS[book]) {
      return res.status(400).json({ error: 'Invalid book' });
    }

    const versionDir = getVersionDirName(version);
    const fileName = `${BIBLE_VERSIONS[version].prefix}${book}_${chapter}.txt`;
    const filePath = `성경들/${versionDir}/${fileName}`;

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filePath
    });
    
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();
    const verses = parseVerses(content, version, book);
    
    // 시작 절과 끝 절이 지정된 경우 필터링
    let filteredVerses = verses;
    if (startVerse && endVerse) {
      const start = parseInt(startVerse);
      const end = parseInt(endVerse);
      filteredVerses = verses.filter(verse => verse.verse >= start && verse.verse <= end);
    }
    
    res.json({
      version: BIBLE_VERSIONS[version].name,
      book: BIBLE_BOOKS[book],
      chapter: parseInt(chapter),
      startVerse: startVerse ? parseInt(startVerse) : null,
      endVerse: endVerse ? parseInt(endVerse) : null,
      verses: filteredVerses
    });
  } catch (err) {
    console.error('절 범위 조회 오류:', err);
    res.status(500).json({ error: 'Failed to read verses' });
  }
});

// Online Bible API - 성경 검색
app.get('/api/biblemulti/search', async (req, res) => {
  try {
    const { query, version, book } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = [];
    const searchVersions = version ? [version] : Object.keys(BIBLE_VERSIONS);
    const searchBooks = book ? [book] : Object.keys(BIBLE_BOOKS);

    for (const ver of searchVersions) {
      if (!BIBLE_VERSIONS[ver]) continue;
      
      const versionDir = getVersionDirName(ver);
      const prefix = `성경들/${versionDir}/`;
      
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET_NAME,
        Prefix: prefix
      });
      
      const listData = await s3Client.send(listCommand);
      
      if (!listData.Contents) continue;

      for (const bk of searchBooks) {
        if (!BIBLE_BOOKS[bk]) continue;

        const chapterFiles = listData.Contents
          .filter(item => {
            const fileName = item.Key.replace(prefix, '');
            return fileName.startsWith(`${BIBLE_VERSIONS[ver].prefix}${bk}_`) && fileName.endsWith('.txt');
          })
          .sort((a, b) => {
            const chapterA = parseInt(a.Key.split('_')[1].replace('.txt', ''));
            const chapterB = parseInt(b.Key.split('_')[1].replace('.txt', ''));
            return chapterA - chapterB;
          });

        for (const file of chapterFiles) {
          const chapter = file.Key.split('_')[1].replace('.txt', '');
          
          const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: file.Key
          });
          
          const response = await s3Client.send(getCommand);
          const content = await response.Body.transformToString();
          const verses = parseVerses(content, ver, bk);
          
          const matchingVerses = verses.filter(verse => 
            verse.text.toLowerCase().includes(query.toLowerCase())
          );

          if (matchingVerses.length > 0) {
            results.push({
              version: BIBLE_VERSIONS[ver].name,
              book: BIBLE_BOOKS[bk],
              chapter: parseInt(chapter),
              verses: matchingVerses
            });
          }
        }
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('성경 검색 오류:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Online Bible 헬퍼 함수들
function getVersionDirName(version) {
  const versionMap = {
    'kornkrv': '개역개정',
    'koreasy': '쉬운성경',
    'korklb': '현대인의성경',
    'kornrsv': '새번역',
    'ENGKJV': 'KJV성경',
    'engNIV': 'NIV성경'
  };
  return versionMap[version] || version;
}

function parseVerses(content, version, book) {
  const lines = content.trim().split('\n');
  const verses = [];
  
  for (const line of lines) {
    const match = line.match(/^(\d{2})([가-힣a-zA-Z]+)\s+(\d+):(\d+)\s+(.+)$/);
    if (match) {
      const [, bookNum, bookShort, chapter, verse, text] = match;
      verses.push({
        book: bookNum,
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        text: text.trim()
      });
    }
  }
  
  return verses;
}

// S3 이미지 프록시
app.get('/api/s3-image', async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ error: '경로가 필요합니다.' });
    }
    
    let imagePath = path;
    
    // 경로 정규화: 연속된 슬래시를 하나로 변환
    imagePath = imagePath.replace(/\/+/g, '/');
    
    // 성경, 교독, 찬송 폴더의 이미지인 경우 .png 확장자 자동 추가
    if ((imagePath.startsWith('성경/') || imagePath.startsWith('교독/') || imagePath.startsWith('찬송/')) && !imagePath.includes('.')) {
      imagePath = `${imagePath}.png`;
    }
    
    console.log(`S3 이미지 요청: ${imagePath}`);
    
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: imagePath
    });
    
    const response = await s3Client.send(command);
    const contentType = response.ContentType || 'image/png';
    
    // 스트림을 버퍼로 변환
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Base64로 인코딩하여 반환
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    res.json({ 
      dataUrl: dataUrl,
      contentType: contentType
    });
  } catch (error) {
    console.error('S3 이미지 프록시 오류:', error);
    console.error(`요청된 경로: ${req.query.path}`);
    res.status(404).json({ error: '이미지를 찾을 수 없습니다.', path: req.query.path });
  }
});

// S3 파일 업로드
app.post('/api/s3-upload', async (req, res) => {
  try {
    const { folderPath, fileName, fileData, fileType } = req.body;
    
    if (!folderPath || !fileName || !fileData) {
      return res.status(400).json({ error: '필수 매개변수가 누락되었습니다.' });
    }
    
    // 성경, 교독, 찬송 폴더의 파일인 경우 확장자 처리
    let finalFileName = fileName;
    if ((folderPath.startsWith('성경/') || folderPath.startsWith('교독/') || folderPath.startsWith('찬송/')) && !fileName.includes('.')) {
      finalFileName = `${fileName}.png`;
    }
    
    const key = folderPath ? `${folderPath}/${finalFileName}` : finalFileName;
    const buffer = Buffer.from(fileData.split(',')[1], 'base64');
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: fileType || 'application/octet-stream'
    });
    
    await s3Client.send(command);
    res.json({ message: '파일이 성공적으로 업로드되었습니다.' });
  } catch (error) {
    console.error('S3 파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
});

// S3 파일 탐색 API
app.get('/api/s3-explorer', async (req, res) => {
  try {
    let path = req.query.path || '';
    if (path && !path.endsWith('/')) path += '/';
    
    console.log(`S3 파일 탐색 요청: path=${path}`);
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: path,
      Delimiter: '/'
    });
    
    const data = await s3Client.send(command);
    
    console.log(`S3 파일 탐색 결과: path=${path}, 총 객체 수=${data.Contents?.length || 0}`);
    if (data.Contents && data.Contents.length > 0) {
      console.log(`파일 목록:`, data.Contents.map(obj => obj.Key));
    }
    
    const folders = (data.CommonPrefixes || []).map(prefix => ({
      name: prefix.Prefix.replace(path, '').replace('/', ''),
      path: prefix.Prefix
    }));
    
    const files = (data.Contents || [])
      .filter(obj => obj.Key !== path)
      .map(obj => {
        const key = obj.Key;
        const name = key.replace(path, '');
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
        
        // 성경, 교독, 찬송 폴더의 파일인 경우 확장자 제거된 이름도 제공
        let displayName = name;
        if ((path.startsWith('성경/') || path.startsWith('교독/') || path.startsWith('찬송/')) && name.endsWith('.png')) {
          displayName = name.replace('.png', '');
        }
        
        return {
          name: name,
          displayName: displayName,
          path: key,
          size: obj.Size,
          lastModified: obj.LastModified,
          isImage: isImage
        };
      });
    
    console.log(`반환할 파일 수: ${files.length}, 폴더 수: ${folders.length}`);
    
    // 캐시 무효화 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ folders, files });
  } catch (error) {
    console.error('S3 파일 탐색 오류:', error);
    res.status(500).json({ error: '파일 목록을 불러올 수 없습니다.' });
  }
});

// S3 폴더 내 파일 목록 API (worship-v1.1.html 호환)
app.get('/api/s3-folder/:type/:content', async (req, res) => {
  try {
    const { type, content } = req.params;
    
    // URL 디코딩 처리
    const decodedContent = decodeURIComponent(content);
    
    // content가 빈 문자열이면 type/ 폴더만 조회, 그렇지 않으면 type/content/ 형태로 구성
    const path = decodedContent ? `${type}/${decodedContent}/` : `${type}/`;
    
    console.log(`S3 폴더 조회: ${type}/${decodedContent}, path: ${path}`);
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: path
    });
    
    const data = await s3Client.send(command);
    
    console.log(`S3 폴더 조회 결과: ${type}/${decodedContent}`);
    console.log(`- 총 객체 수: ${data.Contents?.length || 0}`);
    console.log(`- 객체들:`, data.Contents?.map(obj => obj.Key) || []);
    
    const files = (data.Contents || [])
      .filter(obj => obj.Key !== path)
      .map(obj => {
        const key = obj.Key;
        const fileName = key.replace(path, '');
        console.log(`- 파일명: ${fileName} (원본: ${key})`);
        return fileName;
      });
    
    console.log(`S3 폴더 조회 결과: ${type}/${decodedContent}, 파일 수: ${files.length}`);
    console.log(`- 최종 파일 목록:`, files);
    
    // 찬양 유형의 경우 파일이 없으면 상위 폴더도 확인
    if (type === "찬양" && files.length === 0 && decodedContent) {
      console.log(`찬양 폴더에 파일이 없어서 상위 폴더를 확인합니다: ${type}/`);
      
      const parentCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET_NAME,
        Prefix: `${type}/`
      });
      
      const parentData = await s3Client.send(parentCommand);
      const parentFiles = (parentData.Contents || [])
        .filter(obj => obj.Key !== `${type}/`)
        .map(obj => {
          const key = obj.Key;
          const fileName = key.replace(`${type}/`, '');
          return fileName;
        });
      
      console.log(`찬양 상위 폴더 조회 결과: 파일 수: ${parentFiles.length}`);
      console.log(`- 상위 폴더 파일 목록:`, parentFiles);
      
      // 상위 폴더에 파일이 있으면 해당 파일들을 반환
      if (parentFiles.length > 0) {
        res.json(parentFiles);
        return;
      }
    }
    
    res.json(files);
  } catch (error) {
    console.error('S3 폴더 목록 조회 오류:', error);
    res.status(500).json({ error: '폴더 목록을 불러올 수 없습니다.' });
  }
});

// S3 파일 삭제
app.delete('/api/s3-delete', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: '파일 경로가 필요합니다.' });
    }
    
    const decodedPath = decodeURIComponent(filePath);
    
    // 성경, 교독, 찬송 폴더의 파일인 경우 .png 확장자 자동 추가
    let deletePath = decodedPath;
    if ((decodedPath.startsWith('성경/') || decodedPath.startsWith('교독/') || decodedPath.startsWith('찬송/')) && !decodedPath.includes('.')) {
      deletePath = `${decodedPath}.png`;
    }
    
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: deletePath
    });
    
    await s3Client.send(command);
    res.json({ message: '파일이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('S3 파일 삭제 오류:', error);
    res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
  }
});

// S3 폴더 삭제
app.delete('/api/s3-delete-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: '폴더 경로가 필요합니다.' });
    }
    
    const decodedPath = decodeURIComponent(folderPath);
    const prefix = decodedPath.endsWith('/') ? decodedPath : `${decodedPath}/`;
    
    // 폴더 내 모든 객체 조회
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix
    });
    
    const listResult = await s3Client.send(listCommand);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      // 모든 객체 삭제
      const deleteObjects = listResult.Contents.map(obj => ({ Key: obj.Key }));
      
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: deleteObjects
        }
      });
      
      await s3Client.send(deleteCommand);
      
      // S3 일관성을 위한 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    res.json({ message: '폴더가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('S3 폴더 삭제 오류:', error);
    res.status(500).json({ error: '폴더 삭제에 실패했습니다.' });
  }
});

// S3 날짜별 예배 파일 목록 (admin.html - 날짜별 예배 파일 로드)
app.get('/api/s3/worship-files', async (req, res) => {
  try {
    const { folder } = req.query;
    if (!folder) {
      return res.status(400).json({ error: '폴더명(folder)이 필요합니다.' });
    }
    const prefix = `예배/${folder}/`;
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      Prefix: prefix
    });
    const data = await s3Client.send(command);
    const files = (data.Contents || [])
      .filter(obj => obj.Key !== prefix)
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.split('/').pop()
      }));
    res.json(files);
  } catch (error) {
    console.error('S3 예배 파일 목록 조회 오류:', error);
    res.status(500).json({ error: '예배 파일 목록을 불러올 수 없습니다.' });
  }
});

// S3 예배 파일 내용 조회 (admin.html - 선택한 파일 로드)
app.get('/api/s3/worship-file/:key', async (req, res) => {
  try {
    // key는 admin에서 encodeURIComponent로 넘어옴 (예: 예배%2Fhishalom%2Fworship.json)
    const key = decodeURIComponent(req.params.key || '');
    if (!key) {
      return res.status(400).json({ error: '파일 경로(key)가 필요합니다.' });
    }
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key
    });
    const response = await s3Client.send(command);
    const body = await response.Body.transformToString();
    const contentType = response.ContentType || 'application/json';
    if (contentType.includes('json')) {
      res.json(JSON.parse(body));
    } else {
      res.setHeader('Content-Type', contentType);
      res.send(body);
    }
  } catch (error) {
    console.error('S3 예배 파일 조회 오류:', error);
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    } else {
      res.status(500).json({ error: '파일을 불러올 수 없습니다.' });
    }
  }
});

// S3 버킷 목록 조회 (s3explorer.html용)
app.get('/api/s3/buckets', async (req, res) => {
  try {
    // 현재는 hishalom-data 버킷만 사용하므로 고정 반환
    res.json(['hishalom-data']);
  } catch (error) {
    console.error('S3 버킷 목록 조회 오류:', error);
    res.status(500).json({ error: '버킷 목록을 불러올 수 없습니다.' });
  }
});

// S3 파일 목록 조회 (s3explorer.html용)
app.get('/api/s3/files', async (req, res) => {
  try {
    const { bucket, prefix = '' } = req.query;
    
    if (!bucket) {
      return res.status(400).json({ error: '버킷명이 필요합니다.' });
    }
    
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/'
    });
    
    const data = await s3Client.send(command);
    
    const files = (data.Contents || []).map(obj => ({
      name: obj.Key.split('/').pop(),
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));
    
    const folders = (data.CommonPrefixes || []).map(prefix => ({
      name: prefix.Prefix.replace(prefix, '').replace('/', ''),
      key: prefix.Prefix
    }));
    
    res.json({ files, folders });
  } catch (error) {
    console.error('S3 파일 목록 조회 오류:', error);
    res.status(500).json({ error: '파일 목록을 불러올 수 없습니다.' });
  }
});

// S3 폴더 생성 (s3explorer.html용)
app.post('/api/s3/folder', async (req, res) => {
  try {
    const { bucket, path } = req.body;
    
    if (!bucket || !path) {
      return res.status(400).json({ error: '버킷명과 경로가 필요합니다.' });
    }
    
    // S3에서는 폴더가 실제로는 빈 객체로 생성됨
    const folderKey = path.endsWith('/') ? path : `${path}/`;
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: folderKey,
      Body: ''
    });
    
    await s3Client.send(command);
    res.json({ message: '폴더가 성공적으로 생성되었습니다.' });
  } catch (error) {
    console.error('S3 폴더 생성 오류:', error);
    res.status(500).json({ error: '폴더 생성에 실패했습니다.' });
  }
});

// S3 파일 업로드 (s3explorer.html용)
app.post('/api/s3/upload', async (req, res) => {
  try {
    const { bucket, key, fileData, contentType } = req.body;
    
    if (!bucket || !key || !fileData) {
      return res.status(400).json({ error: '필수 매개변수가 누락되었습니다.' });
    }
    
    const buffer = Buffer.from(fileData.split(',')[1], 'base64');
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream'
    });
    
    await s3Client.send(command);
    res.json({ message: '파일이 성공적으로 업로드되었습니다.' });
  } catch (error) {
    console.error('S3 파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
});

// S3 파일 다운로드 (s3explorer.html용)
app.get('/api/s3/download', async (req, res) => {
  try {
    const { bucket, key } = req.query;
    
    if (!bucket || !key) {
      return res.status(400).json({ error: '버킷명과 키가 필요합니다.' });
    }
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    
    // 파일명 추출
    const fileName = key.split('/').pop();
    
    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // 스트림을 버퍼로 변환하여 응답
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    res.send(buffer);
  } catch (error) {
    console.error('S3 파일 다운로드 오류:', error);
    res.status(500).json({ error: '파일 다운로드에 실패했습니다.' });
  }
});

// S3 파일 삭제 (s3explorer.html용)
app.delete('/api/s3/delete', async (req, res) => {
  try {
    const { bucket, key } = req.body;
    
    if (!bucket || !key) {
      return res.status(400).json({ error: '버킷명과 키가 필요합니다.' });
    }
    
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    await s3Client.send(command);
    res.json({ message: '파일이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('S3 파일 삭제 오류:', error);
    res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
  }
});

// 기본 교회 정보 초기화 API
app.post('/api/init-default-church', async (req, res) => {
  try {
    const putCommand = new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        pk: 'CHURCH#hishalom',
        sk: 'INFO',
        churchName: 'hishalom',
        adminPassword: 'hishalom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    
    await docClient.send(putCommand);
    res.json({ 
      success: true, 
      message: '기본 교회 정보가 초기화되었습니다.',
      churchName: 'hishalom',
      password: 'hishalom'
    });
  } catch (error) {
    console.error('기본 교회 정보 초기화 오류:', error);
    res.status(500).json({ error: '기본 교회 정보 초기화에 실패했습니다.' });
  }
});

// 헬스체크 API
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// S3 텍스트 파일 읽기 (transcribe.html용)
app.get('/api/s3-text', async (req, res) => {
  try {
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: '경로가 필요합니다.' });
    }
    
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: path
    });
    
    const response = await s3Client.send(command);
    
    // 스트림을 문자열로 변환
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const content = buffer.toString('utf-8');
    
    res.json({ content });
  } catch (error) {
    console.error('S3 텍스트 파일 읽기 오류:', error);
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    } else {
      res.status(500).json({ error: '파일을 읽을 수 없습니다.' });
    }
  }
});

// Transcribe 작업 시작
app.post('/api/transcribe/start', async (req, res) => {
  try {
    const { audioFilePath, languageCode, outputBucket, outputKey } = req.body;
    
    if (!audioFilePath || !languageCode || !outputBucket || !outputKey) {
      return res.status(400).json({ error: '필수 매개변수가 누락되었습니다.' });
    }
    
    // 고유한 JobName 생성
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const jobName = `transcribe-${timestamp}-${random}`;
    
    // S3 URI 생성
    const mediaFileUri = `s3://${S3_BUCKET_NAME}/${audioFilePath}`;
    const outputUri = `s3://${outputBucket}/${outputKey}`;
    
    // outputKey에서 한글 및 특수문자를 안전한 형식으로 변환
    // AWS Transcribe는 outputKey에 [a-zA-Z0-9-_.!*'()/&$@=;:+,?] 만 허용
    // 한글 파일명을 base64url 인코딩하여 처리
    function sanitizeOutputKey(key) {
      // 경로 부분과 파일명 분리
      const pathParts = key.split('/');
      const fileName = pathParts.pop();
      const path = pathParts.join('/');
      
      // 파일명이 한글이나 특수문자를 포함하는 경우 base64url 인코딩
      const safeFileName = /^[a-zA-Z0-9-_.!*'()]+$/.test(fileName) 
        ? fileName 
        : Buffer.from(fileName, 'utf-8').toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
      
      return path ? `${path}/${safeFileName}` : safeFileName;
    }
    
    const sanitizedOutputKey = sanitizeOutputKey(outputKey);
    
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: {
        MediaFileUri: mediaFileUri
      },
      MediaFormat: getMediaFormat(audioFilePath),
      LanguageCode: languageCode,
      OutputBucketName: outputBucket,
      OutputKey: sanitizedOutputKey,
      Settings: {
        ShowSpeakerLabels: false
        // MaxAlternatives 제거 (최소값이 2이므로 필요시 2로 설정)
      }
    });
    
    await transcribeClient.send(command);
    
    // 원본 outputKey를 DynamoDB에 저장 (완료 시 원본 파일명으로 복사하기 위해)
    try {
      await docClient.send(new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: {
          pk: `TRANSCRIBE#${jobName}`,
          sk: 'INFO',
          originalOutputKey: outputKey,
          sanitizedOutputKey: sanitizedOutputKey,
          audioFilePath: audioFilePath,
          createdAt: new Date().toISOString()
        }
      }));
    } catch (dbError) {
      console.error('DynamoDB 저장 오류:', dbError);
      // DB 저장 실패해도 계속 진행
    }
    
    res.json({ 
      jobName: jobName,
      originalOutputKey: outputKey, // 원본 파일명 (한글 포함)
      sanitizedOutputKey: sanitizedOutputKey, // Transcribe에 사용된 파일명
      message: 'Transcribe 작업이 시작되었습니다.'
    });
  } catch (error) {
    console.error('Transcribe 작업 시작 오류:', error);
    res.status(500).json({ error: 'Transcribe 작업 시작에 실패했습니다: ' + error.message });
  }
});

// Transcribe 작업 상태 확인
app.get('/api/transcribe/status/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    console.log(`Transcribe 상태 확인 요청: ${jobName}`);
    
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    });
    
    const response = await transcribeClient.send(command);
    const job = response.TranscriptionJob;
    
    if (!job) {
      console.error(`작업을 찾을 수 없음: ${jobName}`);
      return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
    }
    
    const status = job.TranscriptionJobStatus;
    console.log(`작업 상태: ${jobName} - ${status}`);
    
    const result = {
      status: status,
      jobName: jobName
    };
    
    if (status === 'COMPLETED' && job.Transcript && job.Transcript.TranscriptFileUri) {
      result.transcriptUri = job.Transcript.TranscriptFileUri;
      result.outputKey = job.OutputKey;
      
      // Transcribe가 생성한 JSON 파일을 읽어서 텍스트 추출 후 원본 파일명으로 저장
      // 한 번만 처리하도록 체크 (중복 처리 방지)
      if (!result.textExtracted) {
        try {
          console.log(`결과 파일 처리 시작: ${jobName}`);
          console.log(`Transcribe 작업 정보:`, {
            OutputKey: job.OutputKey,
            OutputBucketName: job.OutputBucketName,
            TranscriptFileUri: job.Transcript.TranscriptFileUri
          });
          
          // DynamoDB에서 원본 outputKey 가져오기
          let originalOutputKey = null;
          let sanitizedOutputKey = null;
          try {
            const dbResponse = await docClient.send(new GetCommand({
              TableName: DYNAMODB_TABLE,
              Key: {
                pk: `TRANSCRIBE#${jobName}`,
                sk: 'INFO'
              }
            }));
            
            if (dbResponse.Item) {
              originalOutputKey = dbResponse.Item.originalOutputKey?.replace(/\.json$/, '.txt');
              sanitizedOutputKey = dbResponse.Item.sanitizedOutputKey;
              console.log(`DynamoDB 조회 결과:`, {
                originalOutputKey: dbResponse.Item.originalOutputKey,
                sanitizedOutputKey: sanitizedOutputKey,
                변환된originalOutputKey: originalOutputKey
              });
            }
          } catch (dbError) {
            console.error('DynamoDB 조회 오류:', dbError);
          }
          
          // Transcribe 결과 JSON 파일 경로 추출
          let transcriptKey = null;
          const resultBucket = job.OutputBucketName || 'hishalom-data';
          
          // 방법 1: job.OutputKey 사용 (있을 경우)
          if (job.OutputKey) {
            transcriptKey = job.OutputKey;
            console.log(`OutputKey에서 transcriptKey 추출: ${transcriptKey}`);
          }
          // 방법 2: TranscriptFileUri에서 Key 추출
          else if (job.Transcript.TranscriptFileUri) {
            const uri = job.Transcript.TranscriptFileUri;
            // URI 형식: https://s3.region.amazonaws.com/bucket/key
            // 또는: https://s3-region.amazonaws.com/bucket/key
            const uriMatch = uri.match(/https?:\/\/s3[^\/]*\.amazonaws\.com\/([^\/]+)\/(.+)/);
            if (uriMatch) {
              const bucketFromUri = uriMatch[1];
              transcriptKey = decodeURIComponent(uriMatch[2]);
              console.log(`TranscriptFileUri에서 추출: bucket=${bucketFromUri}, key=${transcriptKey}`);
            } else {
              // 다른 URI 형식 시도
              const uriParts = uri.split('/');
              const bucketIndex = uriParts.findIndex(part => part.includes('amazonaws.com')) + 1;
              if (bucketIndex > 0 && uriParts[bucketIndex + 1]) {
                transcriptKey = uriParts.slice(bucketIndex + 1).join('/');
                console.log(`URI 파싱으로 추출: ${transcriptKey}`);
              }
            }
          }
          
          // 방법 3: sanitizedOutputKey 사용 (DynamoDB에서 가져온 경우)
          if (!transcriptKey && sanitizedOutputKey) {
            transcriptKey = sanitizedOutputKey;
            console.log(`sanitizedOutputKey 사용: ${transcriptKey}`);
          }
          
          if (!transcriptKey) {
            throw new Error('Transcribe 결과 파일 경로를 찾을 수 없습니다.');
          }
          
          // 원본 outputKey가 없으면 transcriptKey에서 추론
          if (!originalOutputKey) {
            // transcriptKey가 base64url 인코딩된 경우 디코딩 시도
            const keyParts = transcriptKey.split('/');
            const fileName = keyParts.pop();
            const path = keyParts.join('/');
            
            // base64url 디코딩 시도 (파일명이 base64 형식인지 확인)
            try {
              // base64url 디코딩
              const base64 = fileName.replace(/-/g, '+').replace(/_/g, '/');
              const decoded = Buffer.from(base64, 'base64').toString('utf-8');
              originalOutputKey = path ? `${path}/${decoded.replace(/\.json$/, '.txt')}` : decoded.replace(/\.json$/, '.txt');
              console.log(`transcriptKey에서 원본 파일명 추론: ${originalOutputKey}`);
            } catch (decodeError) {
              // 디코딩 실패 시 그대로 사용
              originalOutputKey = transcriptKey.replace(/\.json$/, '.txt');
              console.log(`디코딩 실패, transcriptKey 그대로 사용: ${originalOutputKey}`);
            }
          }
          
          console.log(`Transcribe 결과 파일 읽기: s3://${resultBucket}/${transcriptKey}`);
          const transcriptResponse = await s3Client.send(new GetObjectCommand({
            Bucket: resultBucket,
            Key: transcriptKey
          }));
          
          // JSON 파일 읽기
          const chunks = [];
          for await (const chunk of transcriptResponse.Body) {
            chunks.push(chunk);
          }
          const transcriptJson = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          
          // 텍스트 추출
          // AWS Transcribe 결과 구조: results.transcripts 배열
          let transcriptText = '';
          if (transcriptJson.results && transcriptJson.results.transcripts) {
            transcriptText = transcriptJson.results.transcripts
              .map(t => t.transcript)
              .join('\n');
          } else if (transcriptJson.transcripts) {
            // 다른 형식의 응답 구조 지원
            transcriptText = transcriptJson.transcripts
              .map(t => t.transcript)
              .join('\n');
          } else {
            console.error('예상치 못한 Transcribe 결과 구조:', JSON.stringify(transcriptJson).substring(0, 500));
            throw new Error('Transcribe 결과 구조를 파싱할 수 없습니다.');
          }
          
          console.log(`텍스트 추출 완료 (길이: ${transcriptText.length}자)`);
          
          // 원본 파일명으로 텍스트 파일 저장
          console.log(`텍스트 파일 저장: s3://${resultBucket}/${originalOutputKey}`);
          await s3Client.send(new PutObjectCommand({
            Bucket: resultBucket,
            Key: originalOutputKey,
            Body: Buffer.from(transcriptText, 'utf-8'),
            ContentType: 'text/plain; charset=utf-8'
          }));
          
          // 저장 확인
          try {
            const verifyResponse = await s3Client.send(new HeadObjectCommand({
              Bucket: resultBucket,
              Key: originalOutputKey
            }));
            console.log(`텍스트 파일 저장 확인 성공: ${originalOutputKey}, 크기: ${verifyResponse.ContentLength} bytes`);
          } catch (verifyError) {
            console.error(`텍스트 파일 저장 확인 실패: ${originalOutputKey}`, verifyError);
          }
          
          result.originalOutputKey = originalOutputKey;
          result.textExtracted = true;
          console.log(`결과 파일 처리 완료: ${originalOutputKey}`);
        } catch (copyError) {
          console.error('결과 파일 처리 오류:', copyError);
          result.textExtractionError = copyError.message;
          // 복사 실패해도 계속 진행
        }
      } else {
        console.log(`결과 파일 이미 처리됨: ${jobName}`);
      }
    } else if (status === 'FAILED') {
      result.failureReason = job.FailureReason || '알 수 없는 오류';
    }
    
    res.json(result);
  } catch (error) {
    console.error('Transcribe 상태 확인 오류:', error);
    if (error.name === 'BadRequestException') {
      res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
    } else {
      res.status(500).json({ error: '상태 확인에 실패했습니다: ' + error.message });
    }
  }
});

// Transcribe 작업 취소
app.delete('/api/transcribe/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const command = new DeleteTranscriptionJobCommand({
      TranscriptionJobName: jobName
    });
    
    await transcribeClient.send(command);
    
    res.json({ message: '작업이 취소되었습니다.' });
  } catch (error) {
    console.error('Transcribe 작업 취소 오류:', error);
    res.status(500).json({ error: '작업 취소에 실패했습니다: ' + error.message });
  }
});

// 텍스트 파일 저장 (편집된 내용)
app.put('/api/transcribe/save-text', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: '필수 매개변수가 누락되었습니다.' });
    }
    
    const buffer = Buffer.from(content, 'utf-8');
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filePath,
      Body: buffer,
      ContentType: 'text/plain; charset=utf-8'
    });
    
    await s3Client.send(command);
    
    res.json({ message: '텍스트가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('텍스트 저장 오류:', error);
    res.status(500).json({ error: '텍스트 저장에 실패했습니다: ' + error.message });
  }
});

// 미디어 형식 추출 헬퍼 함수
function getMediaFormat(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const formatMap = {
    'mp3': 'mp3',
    'wav': 'wav',
    'm4a': 'mp4',
    'flac': 'flac',
    'mp4': 'mp4'
  };
  return formatMap[ext] || 'mp3';
}

// 404 핸들러 (모든 라우트 정의 이후에 위치)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API 엔드포인트를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('서버 오류:', error);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

module.exports.handler = serverless(app); 