/**
 * Organization, LocalBusiness and every schema.org subtype of them.
 * Source: the schema.org type hierarchy (vocabulary version 29). The list is static, so the check
 * makes no network call. To update it, compare it with https://schema.org/Organization.
 */
export const ORGANIZATION_TYPES: ReadonlySet<string> = new Set([
  // Organization and its direct subtypes.
  'Organization', 'Airline', 'Consortium', 'Cooperative', 'Corporation', 'EducationalOrganization',
  'FundingScheme', 'GovernmentOrganization', 'LibrarySystem', 'LocalBusiness', 'MedicalOrganization', 'NGO',
  'NewsMediaOrganization', 'OnlineBusiness', 'PerformingGroup', 'PoliticalParty', 'Project',
  'ResearchOrganization', 'SearchRescueOrganization', 'SportsOrganization', 'WorkersUnion',
  // EducationalOrganization
  'CollegeOrUniversity', 'ElementarySchool', 'HighSchool', 'MiddleSchool', 'Preschool', 'School',
  // MedicalOrganization
  'Dentist', 'DiagnosticLab', 'Hospital', 'MedicalClinic', 'CovidTestingFacility', 'Pharmacy', 'Physician',
  'IndividualPhysician', 'PhysiciansOffice', 'VeterinaryCare',
  // OnlineBusiness, PerformingGroup, Project, SportsOrganization
  'OnlineStore', 'DanceGroup', 'MusicGroup', 'TheaterGroup', 'FundingAgency', 'ResearchProject', 'SportsTeam',
  // LocalBusiness direct subtypes.
  'AnimalShelter', 'ArchiveOrganization', 'AutomotiveBusiness', 'ChildCare', 'DryCleaningOrLaundry',
  'EmergencyService', 'EmploymentAgency', 'EntertainmentBusiness', 'FinancialService', 'FoodEstablishment',
  'GovernmentOffice', 'HealthAndBeautyBusiness', 'HomeAndConstructionBusiness', 'InternetCafe', 'LegalService',
  'Library', 'LodgingBusiness', 'MedicalBusiness', 'ProfessionalService', 'RadioStation', 'RealEstateAgent',
  'RecyclingCenter', 'SelfStorage', 'ShoppingCenter', 'SportsActivityLocation', 'Store', 'TelevisionStation',
  'TouristInformationCenter', 'TravelAgency',
  // AutomotiveBusiness
  'AutoBodyShop', 'AutoDealer', 'AutoPartsStore', 'AutoRental', 'AutoRepair', 'AutoWash', 'GasStation',
  'MotorcycleDealer', 'MotorcycleRepair',
  // EmergencyService
  'FireStation', 'PoliceStation',
  // EntertainmentBusiness
  'AdultEntertainment', 'AmusementPark', 'ArtGallery', 'Casino', 'ComedyClub', 'MovieTheater', 'NightClub',
  // FinancialService
  'AccountingService', 'AutomatedTeller', 'BankOrCreditUnion', 'InsuranceAgency',
  // FoodEstablishment
  'Bakery', 'BarOrPub', 'Brewery', 'CafeOrCoffeeShop', 'Distillery', 'FastFoodRestaurant', 'IceCreamShop',
  'Restaurant', 'Winery',
  // GovernmentOffice
  'PostOffice',
  // HealthAndBeautyBusiness
  'BeautySalon', 'DaySpa', 'HairSalon', 'HealthClub', 'NailSalon', 'TattooParlor',
  // HomeAndConstructionBusiness
  'Electrician', 'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany', 'Plumber',
  'RoofingContractor',
  // LegalService
  'Attorney', 'Notary',
  // LodgingBusiness
  'BedAndBreakfast', 'Campground', 'Hostel', 'Hotel', 'Motel', 'Resort', 'SkiResort', 'VacationRental',
  // MedicalBusiness
  'CommunityHealth', 'Dermatology', 'DietNutrition', 'Emergency', 'Geriatric', 'Gynecologic', 'Midwifery',
  'Nursing', 'Obstetric', 'Oncologic', 'Optician', 'Optometric', 'Otolaryngologic', 'Pediatric', 'Physiotherapy',
  'PlasticSurgery', 'Podiatric', 'PrimaryCare', 'Psychiatric', 'PublicHealth',
  // SportsActivityLocation
  'BowlingAlley', 'ExerciseGym', 'GolfCourse', 'PublicSwimmingPool', 'SportsClub', 'StadiumOrArena',
  'TennisComplex',
  // Store
  'BikeStore', 'BookStore', 'ClothingStore', 'ComputerStore', 'ConvenienceStore', 'DepartmentStore',
  'ElectronicsStore', 'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore', 'HobbyShop',
  'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore', 'MobilePhoneStore', 'MovieRentalStore',
  'MusicStore', 'OfficeEquipmentStore', 'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
  'TireShop', 'ToyStore', 'WholesaleStore',
]);
