import google.generativeai as genai
import time
import os
from dotenv import load_dotenv

# ១. រៀបចំ API Key (ត្រូវនៅខាងលើគេជានិច្ច)
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ២. បង្កើត Function (ត្រូវ Define មុននឹងយកទៅប្រើ)
def benchmark_ai_speed(prompt_type, content):
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    instruction = "សង្ខេបខ្លីខ្លឹម" if prompt_type == "brief" else "ពន្យល់លម្អិតឱ្យបានស៊ីជម្រៅ"
    full_prompt = f"ក្នុងនាមជាអ្នកជំនាញវប្បធម៌ខ្មែរ សូមជួយ {instruction} លើអត្ថបទនេះ៖ {content}"

    print(f"\n🚀 កំពុងតេស្តល្បឿនសម្រាប់ប្រភេទ: {prompt_type.upper()}...")
    
    start_time = time.time()
    
    try:
        response = model.generate_content(full_prompt)
        end_time = time.time()
        
        duration = end_time - start_time
        
        print(f"✅ ជោគជ័យ!")
        print(f"⏱️ រយៈពេលចំណាយ: {duration:.2f} វិនាទី")
        print(f"📄 ចំនួនអក្សរដែលទទួលបាន: {len(response.text)} តួ")
        return duration
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# --- ៣. ចាប់ផ្ដើមការតេស្ត (ហៅមកប្រើនៅខាងក្រោមគេបង្អស់) ---
sample_content = "ប្រវត្តិប្រាសាទអង្គរវត្ត និងការវិវត្តនៃសម្លៀកបំពាក់ខ្មែរ"

# ហៅ Function មកប្រើ
time_brief = benchmark_ai_speed("brief", sample_content)

print("\n⏳ កំពុងសម្រាក ១៥ វិនាទី ដើម្បីកុំឱ្យស្ទះ API Quota...")
time.sleep(15) 

time_detailed = benchmark_ai_speed("detailed", sample_content)

if time_brief and time_detailed:
    diff = time_detailed - time_brief
    print(f"\n📊 សេចក្ដីសន្និដ្ឋាន: Detailed Mode យឺតជាង Brief Mode ចំនួន {diff:.2f} វិនាទី")